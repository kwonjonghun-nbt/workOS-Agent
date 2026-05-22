export const macroKeys = {
  all: ['macro'] as const,
  state: () => [...macroKeys.all, 'state'] as const,
};
