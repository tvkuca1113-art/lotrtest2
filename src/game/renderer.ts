import Phaser from 'phaser';
/** Software WebGL is slower than Canvas for these transparent 2D sprites.
 * Release the tiny probe context immediately; never depend on a remote GPU/API. */
export function chooseRenderer():number {
    const canvas=document.createElement('canvas');
    let gl:WebGLRenderingContext|null=null;
    try {
        gl=canvas.getContext('webgl',{failIfMajorPerformanceCaveat:true});
        if(!gl)return Phaser.CANVAS;
        const debug=gl.getExtension('WEBGL_debug_renderer_info');
        const renderer=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';
        return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)?Phaser.CANVAS:Phaser.AUTO;
    } catch {return Phaser.CANVAS;}
    finally {gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
}
