export const temporalFragGLSL = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uNewSample;
uniform sampler2D uPrevAccum;
uniform vec2 uResolution;
uniform float uBlendFactor;

// RGB to YCoCg for better clamping
vec3 RGBToYCoCg( vec3 rgb ) {
    float Y = dot( rgb, vec3(  1, 2,  1 ) ) * 0.25;
    float Co= dot( rgb, vec3(  2, 0, -2 ) ) * 0.25;
    float Cg= dot( rgb, vec3( -1, 2, -1 ) ) * 0.25;
    return vec3( Y, Co, Cg );
}

// YCoCg to RGB
vec3 YCoCgToRGB( vec3 ycocg ) {
    float Y = ycocg.x;
    float Co= ycocg.y;
    float Cg= ycocg.z;
    float r = Y + Co - Cg;
    float g = Y + Cg;
    float b = Y - Co - Cg;
    return vec3( r, g, b );
}

void main() {
    vec4 newData = texture2D(uNewSample, vUv);
    vec4 prevData = texture2D(uPrevAccum, vUv);

    vec3 colorCenter = newData.rgb;
    vec2 p = 1.0 / uResolution;

    vec3 c0 = texture2D(uNewSample, vUv + vec2(-p.x, -p.y)).rgb;
    vec3 c1 = texture2D(uNewSample, vUv + vec2( 0.0, -p.y)).rgb;
    vec3 c2 = texture2D(uNewSample, vUv + vec2( p.x, -p.y)).rgb;
    vec3 c3 = texture2D(uNewSample, vUv + vec2(-p.x,  0.0)).rgb;
    vec3 c4 = texture2D(uNewSample, vUv + vec2( p.x,  0.0)).rgb;
    vec3 c5 = texture2D(uNewSample, vUv + vec2(-p.x,  p.y)).rgb;
    vec3 c6 = texture2D(uNewSample, vUv + vec2( 0.0,  p.y)).rgb;
    vec3 c7 = texture2D(uNewSample, vUv + vec2( p.x,  p.y)).rgb;

    vec3 cmin = min(colorCenter, min(min(min(c0, c1), min(c2, c3)), min(min(c4, c5), min(c6, c7))));
    vec3 cmax = max(colorCenter, max(max(max(c0, c1), max(c2, c3)), max(max(c4, c5), max(c6, c7))));

    // Convert to YCoCg to clamp chroma and luma correctly
    vec3 prevYCoCg = RGBToYCoCg(prevData.rgb);
    vec3 minYCoCg = RGBToYCoCg(cmin);
    vec3 maxYCoCg = RGBToYCoCg(cmax);

    // Ensure min < max
    vec3 clampedYCoCg = clamp(prevYCoCg, min(minYCoCg, maxYCoCg), max(minYCoCg, maxYCoCg));
    vec3 clampedPrev = YCoCgToRGB(clampedYCoCg);

    float blend = uBlendFactor;
    float newDepth = abs(newData.a);
    float prevDepth = abs(prevData.a);

    // Depth rejection: reset if geometry changed drastically
    if (newDepth > 0.0 && abs(newDepth - prevDepth) > 0.5) {
        blend = 1.0;
    }

    // Combine
    vec3 result = mix(clampedPrev, newData.rgb, blend);
    gl_FragColor = vec4(result, newData.a);
}
`;
