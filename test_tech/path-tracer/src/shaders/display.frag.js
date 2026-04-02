export const displayFragGLSL = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uTexture;
uniform float uExposure;
uniform float uGamma;

void main() {
    vec3 color = texture2D(uTexture, vUv).rgb;
    color = vec3(1.0) - exp(-color * uExposure);
    color = pow(color, vec3(1.0 / uGamma));
    gl_FragColor = vec4(color, 1.0);
}
`;
