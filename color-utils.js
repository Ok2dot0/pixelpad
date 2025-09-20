// Color utility functions extracted for reuse and testing
export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToHsv(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
        }
        h /= 6;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return {h, s, v};
}

export function hsvToHex(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r=v; g=t; b=p; break;
        case 1: r=q; g=v; b=p; break;
        case 2: r=p; g=v; b=t; break;
        case 3: r=p; g=q; b=v; break;
        case 4: r=t; g=p; b=v; break;
        case 5: r=v; g=p; b=q; break;
    }
    const toHex = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

export function hexToHsl(hex){
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0, s=0; const l=(max+min)/2;
    if (max!==min){
        const d=max-min;
        s = l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
            case r: h=(g-b)/d + (g<b?6:0); break;
            case g: h=(b-r)/d + 2; break;
            case b: h=(r-g)/d + 4; break;
        }
        h/=6;
    }
    return {h,s,l};
}

export function hslToHex(h,s,l){
    const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3 - t)*6; return p; };
    let r,g,b;
    if (s===0){ r=g=b=l; } else {
        const q = l<0.5 ? l*(1+s) : l+s-l*s;
        const p = 2*l - q;
        r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
    }
    const toHex=(x)=>('0'+Math.round(x*255).toString(16)).slice(-2);
    return '#'+toHex(r)+toHex(g)+toHex(b);
}

export function rotateHue(h, deg){ let nh=(h + deg/360)%1; if(nh<0) nh+=1; return nh; }
