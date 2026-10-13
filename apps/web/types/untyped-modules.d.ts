// These packages ship no typings (and intuit-oauth / node-quickbooks have no
// @types package on npm). The web type check follows imports into apps/api,
// so they are declared untyped here as well.
declare module "intuit-oauth";
declare module "node-quickbooks";
declare module "cookie";
