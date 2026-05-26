export const slackKeys = {
  all: ['slack'] as const,
  channels: () => [...slackKeys.all, 'channels'] as const,
};
