import * as oauth from 'oauth4webapi'
import type { Cookie, InternalRequest, InternalResponse } from '$lib/integrations/response'
import * as checks from '$lib/integrations/check'
import type { Provider, InternalOIDCConfig } from '.';


export class OIDCProvider implements Provider<InternalOIDCConfig> {
  constructor(readonly config: InternalOIDCConfig) {}

  async signIn(request: InternalRequest): Promise<InternalResponse> {
    const provider = this.config
    const cookies: Cookie[] = []
    const { url } = provider.authorization

    if (provider.checks?.includes('state')) {
      const [state, stateCookie] = await checks.state.create(provider)
      url.searchParams.set('state', state)
      cookies.push(stateCookie)
    }

    if (provider.checks?.includes('pkce')) {
      if (provider.authorizationServer.code_challenge_methods_supported?.includes('S256')) {
        provider.checks = ['nonce']
      } else {
        const [pkce, pkceCookie] = await checks.pkce.create(provider)
        url.searchParams.set('code_challenge', pkce)
        url.searchParams.set('code_challenge_method', 'S256')
        cookies.push(pkceCookie)
      }
    }

    if (provider.checks?.includes('nonce')) {
      const [nonce, nonceCookie] = await checks.nonce.create(provider)
      url.searchParams.set('nonce', nonce)
      cookies.push(nonceCookie)
    }

    if (!url.searchParams.has('redirect_uri')) {
      url.searchParams.set('redirect_uri', `${request.url.origin}/callback/${provider.id}`)
    }

    if (!url.searchParams.has('scope')) {
      url.searchParams.set("scope", "openid profile email")
    }

    return { redirect: url.toString(), cookies }
  }

  async callback(request: InternalRequest): Promise<InternalResponse> {
    const provider = this.config

    const cookies: Cookie[] = []

    const [state, stateCookie] = await checks.state.use(request, provider)

    if (stateCookie) cookies.push(stateCookie)

    const codeGrantParams = oauth.validateAuthResponse(
      provider.authorizationServer,
      provider.client,
      provider.authorization.url.searchParams,
      state,
    )

    if (oauth.isOAuth2Error(codeGrantParams)) throw new Error(codeGrantParams.error_description)

    const [pkce, pkceCookie] = await checks.pkce.use(request, provider)

    if (pkceCookie) cookies.push(pkceCookie)

    const initialCodeGrantResponse = await oauth.authorizationCodeGrantRequest(
      provider.authorizationServer,
      provider.client,
      codeGrantParams,
      'auth url',
      pkce,
    )

    const codeGrantResponse = await provider.token.conform(initialCodeGrantResponse.clone())

    const challenges = oauth.parseWwwAuthenticateChallenges(codeGrantResponse)

    if (challenges) {
      challenges.forEach(challenge => { console.log("challenge", challenge) })
      throw new Error("TODO: Handle www-authenticate challenges as needed")
    }

    const [nonce, nonceCookie] = await checks.nonce.use(request, provider)

    if (nonceCookie) cookies.push(nonceCookie)

    const result = await oauth.processAuthorizationCodeOpenIDResponse(
      provider.authorizationServer,
      provider.client,
      codeGrantResponse,
      nonce,
    )

    if (oauth.isOAuth2Error(result)) throw new Error("TODO: Handle OIDC response body error")

    const profile = oauth.getValidatedIdTokenClaims(result)

    const profileResult = await provider.profile(profile, result)

    return { ...profileResult, cookies }
  }

  async signOut(request: InternalRequest): Promise<InternalResponse> {
    console.log("OIDCProvider.signOut not implemented ", request)
    return {}
  }
}