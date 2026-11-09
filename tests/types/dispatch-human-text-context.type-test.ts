/**
 * TC-HDA-032 type half — the additive optional `HumanTextContext` third
 * parameter of `CommandDefinition.humanText`. A two-parameter definition and a
 * direct two-argument call stay valid; the context is exactly
 * `{ readonly verbose: boolean }`.
 *
 * Compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not run by Bun.
 */

import type { CommandDefinition, HumanTextContext } from "../../packages/cli/src/index";
import type { BrandIdentity } from "../../packages/core/src/contracts/index";

const twoParameter: CommandDefinition = {
  handler: () => ({ data: {} }),
  humanText: (data, brand) => `${brand.binaryName}:${String(data)}`,
};

const threeParameter: CommandDefinition = {
  handler: () => ({ data: {} }),
  humanText: (data, brand, context) =>
    `${brand.binaryName}:${String(data)}:${String(context?.verbose)}`,
};

const brand = { binaryName: "delivery-os" } as unknown as BrandIdentity;

const directTwoArgument: string | undefined = twoParameter.humanText?.({}, brand);
const directThreeArgument: string | undefined = twoParameter.humanText?.({}, brand, {
  verbose: true,
});

const context: HumanTextContext = { verbose: false };
const omittedContext: HumanTextContext | undefined = undefined;

const rejectedContext: HumanTextContext = {
  // @ts-expect-error — `verbose` is a boolean, never a string.
  verbose: "yes",
};

export {
  context,
  directThreeArgument,
  directTwoArgument,
  omittedContext,
  rejectedContext,
  threeParameter,
  twoParameter,
};
