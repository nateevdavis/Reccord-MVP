export type TutorialStepId =
  | 'create-list'
  | 'title'
  | 'description'
  | 'price'
  | 'public'
  | 'source-type'
  | 'connect-spotify'
  | 'connect-apple-music'
  | 'music-url'
  | 'manual-item'
  | 'save'
  | 'share'

export interface TutorialStep {
  id: TutorialStepId
  targetSelector: string
  position: 'top' | 'bottom' | 'left' | 'right'
  copy: string
  cta?: string
  skipText?: string
  conditional?: (context: any) => boolean
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'create-list',
    targetSelector: '[data-tutorial="create-link"]',
    position: 'bottom',
    copy: "Let's create your first list.",
    cta: 'Start',
    skipText: 'Skip tutorial',
  },
  {
    id: 'source-type',
    targetSelector: '[data-tutorial="source-type"]',
    position: 'bottom',
    copy: 'Choose how you want to add items to your list.',
  },
  {
    id: 'title',
    targetSelector: '[data-tutorial="title"]',
    position: 'bottom',
    copy: 'Give your list a clear title—this is what subscribers will see first.',
  },
  {
    id: 'description',
    targetSelector: '[data-tutorial="description"]',
    position: 'bottom',
    copy: 'Add a short description so people know what the list is about.',
  },
  {
    id: 'price',
    targetSelector: '[data-tutorial="price"]',
    position: 'bottom',
    copy: 'Set your monthly price. You can change this anytime.',
  },
  {
    id: 'public',
    targetSelector: '[data-tutorial="public"]',
    position: 'bottom',
    copy: 'Make your list public to start building your audience.',
  },
  {
    id: 'connect-spotify',
    targetSelector: '[data-tutorial="connect-spotify"]',
    position: 'bottom',
    copy: 'Connect your Spotify account to sync playlists.',
    conditional: (context) => {
      return context?.sourceType === 'SPOTIFY' && !context?.spotifyConnected
    },
  },
  {
    id: 'connect-apple-music',
    targetSelector: '[data-tutorial="connect-apple-music"]',
    position: 'bottom',
    copy: 'Connect your Apple Music account to sync playlists.',
    conditional: (context) => {
      return context?.sourceType === 'APPLE_MUSIC' && !context?.appleMusicConnected
    },
  },
  {
    id: 'music-url',
    targetSelector: '[data-tutorial="music-url"]',
    position: 'bottom',
    copy: 'Paste a Spotify or Apple Music URL to auto-add items.',
    conditional: (context) => {
      if (context?.sourceType === 'SPOTIFY') {
        return context?.spotifyConnected === true
      }
      if (context?.sourceType === 'APPLE_MUSIC') {
        return context?.appleMusicConnected === true
      }
      return false
    },
  },
  {
    id: 'manual-item',
    targetSelector: '[data-tutorial="manual-item"]',
    position: 'bottom',
    copy: 'Add an item manually—title, link, and notes.',
    conditional: (context) => {
      return context?.sourceType === 'MANUAL'
    },
  },
  {
    id: 'save',
    targetSelector: '[data-tutorial="save"]',
    position: 'top',
    copy: 'Save your list to publish it.',
  },
  {
    id: 'share',
    targetSelector: '[data-tutorial="share"]',
    position: 'bottom',
    copy: 'Share your list with your audience. This is your public link.',
    cta: 'Finish Tutorial',
  },
]

export function getStepById(id: TutorialStepId): TutorialStep | undefined {
  return tutorialSteps.find((step) => step.id === id)
}

export function getNextStep(
  currentStepId: TutorialStepId,
  context?: any
): TutorialStep | null {
  const currentIndex = tutorialSteps.findIndex((step) => step.id === currentStepId)
  if (currentIndex === -1) return null

  // Find next step that passes conditional check
  for (let i = currentIndex + 1; i < tutorialSteps.length; i++) {
    const step = tutorialSteps[i]
    if (!step.conditional || step.conditional(context)) {
      return step
    }
  }

  return null
}

