// The web type check follows imports into apps/api (tRPC router types), which
// reach intuit-oauth and node-quickbooks. Neither ships typings and neither has
// a @types package on npm, so declare them as untyped here (and in apps/api).
declare module "intuit-oauth";
declare module "node-quickbooks";
