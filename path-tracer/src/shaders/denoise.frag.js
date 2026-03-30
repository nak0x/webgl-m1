export const denoiseFragGLSL = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uInput;
uniform vec2 uResolution;
uniform float uColorSigma;
uniform float uDepthSigma;

void main() {
    vec2 texel = 1.0 / uResolution;
    vec4 centerData = texture2D(uInput, vUv);
    vec3 centerColor = centerData.rgb;
    float centerDepth = abs(centerData.a);

    vec3 sum = vec3(0.0);
    float weightSum = 0.0;

    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texel;
            vec4 sampleData = texture2D(uInput, vUv + offset);

            float spatialW = exp(-float(x * x + y * y) / 8.0);
            vec3 cDiff = centerColor - sampleData.rgb;
            float colorW = exp(-dot(cDiff, cDiff) / (2.0 * uColorSigma * uColorSigma));
            float dDiff = abs(centerDepth - abs(sampleData.a));
            float depthW = exp(-dDiff / (2.0 * uDepthSigma * uDepthSigma));

            float w = spatialW * colorW * depthW;
            sum += sampleData.rgb * w;
            weightSum += w;
        }
    }

    gl_FragColor = vec4(sum / weightSum, centerData.a);
}
`;
