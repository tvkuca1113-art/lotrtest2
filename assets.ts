declare global {interface Window{__HEARTH_ASSETS__?:Record<string,string>}}
export const assetUrl=(path:string)=>window.__HEARTH_ASSETS__?.[path]??path;
