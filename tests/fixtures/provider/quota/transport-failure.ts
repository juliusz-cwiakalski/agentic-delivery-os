export const transportFailure = async (): Promise<never> => {
  throw new Error("transport unavailable");
};
