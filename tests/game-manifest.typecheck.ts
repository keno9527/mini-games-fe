import type { EmbeddedGameRuntime, ExternalGameRuntime, GameModule } from '../src/games/manifest.ts'

declare const loadGameModule: () => Promise<GameModule>

export const validEmbeddedRuntime: EmbeddedGameRuntime = {
  kind: 'embedded',
  load: loadGameModule,
}

export const validExternalRuntime: ExternalGameRuntime = {
  kind: 'external',
  href: 'https://example.com/game',
  openIn: 'new-tab',
}

const insecureRuntime = {
  kind: 'external' as const,
  href: 'http://example.com/game' as const,
  openIn: 'new-tab' as const,
}

// @ts-expect-error external game URLs must use HTTPS
export const rejectedInsecureRuntime: ExternalGameRuntime = insecureRuntime

const mixedExternalRuntime = {
  ...validExternalRuntime,
  load: loadGameModule,
}

// @ts-expect-error external runtimes cannot load an embedded module
export const rejectedMixedExternalRuntime: ExternalGameRuntime = mixedExternalRuntime

const mixedEmbeddedRuntime = {
  ...validEmbeddedRuntime,
  href: 'https://example.com/game' as const,
}

// @ts-expect-error embedded runtimes cannot declare an external URL
export const rejectedMixedEmbeddedRuntime: EmbeddedGameRuntime = mixedEmbeddedRuntime
