type AwaitedRecord<T extends Record<string, any>> = {
  [K in keyof T]: Awaited<T[K]>;
};

type AwaitableRecord<T extends Record<string, any>> = {
  [K in keyof T]: Promise<Awaited<T[K]>> | Awaited<T[K]>;
};

const createFixtureUtil = <
  Parameters extends Record<string, any>,
  Predicate extends (params: AwaitedRecord<Parameters>) => Promise<any>
>(
  defaultParams: () => Parameters,
  utilPredicate: Predicate
) => {
  return Object.assign(
    async (params?: Partial<AwaitableRecord<Parameters>>) => {
      const fullParams = Object.assign(defaultParams(), params ?? {});

      for (const [key, value] of Object.entries(fullParams)) {
        (fullParams as any)[key] = await value;
      }

      return utilPredicate(fullParams) as Predicate extends (
        params: AwaitedRecord<Parameters>
      ) => Promise<infer R>
        ? R
        : never;
    },
    {
      getDefaultResolvedParams: async () => {
        const fullParams = defaultParams();

        for (const [key, value] of Object.entries(fullParams)) {
          (fullParams as any)[key] = await value;
        }

        return fullParams as AwaitedRecord<Parameters>;
      }
    }
  );
};

export { createFixtureUtil };
