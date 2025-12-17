// Type declarations for frontend asset imports with Bun's text import
declare module "*.html" {
  const content: unknown;
  export default content;
}

declare module "*.css" {
  const content: unknown;
  export default content;
}

declare module "*.js" {
  const content: unknown;
  export default content;
}
