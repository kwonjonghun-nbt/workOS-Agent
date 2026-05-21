export const extensionKeys = {
  all: ['extension'] as const,
  list: () => [...extensionKeys.all, 'list'] as const,
};
