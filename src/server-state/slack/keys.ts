export const slackKeys = {
  all: ['slack'] as const,
  channels: () => [...slackKeys.all, 'channels'] as const,
  threadChannels: () => [...slackKeys.all, 'threadChannels'] as const,
  threadChannel: (channelId: string) =>
    [...slackKeys.all, 'threadChannel', channelId] as const,
};
