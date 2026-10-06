declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MdxContent: ComponentType;
  export default MdxContent;
}
