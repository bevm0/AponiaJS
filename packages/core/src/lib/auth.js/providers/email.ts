import type { InternalRequest, InternalResponse } from '$lib/integrations/response'
import type { Provider } from './index'
import type { InternalEmailConfig } from '../providers'


export class EmailProvider implements Provider<InternalEmailConfig> {
  constructor(readonly config: InternalEmailConfig) {}

  async signIn(request: InternalRequest, provider: InternalEmailConfig): Promise<InternalResponse> {
    return {}
  }

  async callback(request: InternalRequest, provider: InternalEmailConfig): Promise<InternalResponse> {
    return {}
  }

  async signOut(request: InternalRequest, provider: InternalEmailConfig): Promise<InternalResponse> {
    return {}
  }
}
