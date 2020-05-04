import module from "module";
export const require = module.createRequire(import.meta.url);
