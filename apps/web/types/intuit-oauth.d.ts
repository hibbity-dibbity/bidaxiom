// The web type check follows imports into apps/api (tRPC router types), which
// reach intuit-oauth. The package ships no typings, and @types/intuit-oauth is
// not installed. Declare it as untyped so the build can finish.
// TODO: add @types/intuit-oauth to apps/api and delete this file.
declare module "intuit-oauth";
