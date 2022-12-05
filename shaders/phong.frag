precision highp float;

const int MAX_LIGHTS = 8;
const float PI = 3.14159265359;

struct LightInfo {
    // Light colour intensities
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    // Light geometry (in camera coordinates)
    vec4 position;
    vec3 axis;
    float aperture;
    float cutoff;
};

struct MaterialInfo {
    vec3 Ka;
    vec3 Kd;
    vec3 Ks;
    float shininess;
};

// Effective number of lights used
uniform int uNLights;

// The array of lights present in the scene
uniform LightInfo uLights[MAX_LIGHTS];

// The material of the object being drawn
uniform MaterialInfo uMaterial;

varying vec3 fNormal;
varying vec3 fPos;

float attenuate(float dist) {
    return min(1.0, 1.0 / (0.1 + 0.01 * dist + 0.001 * pow(dist, 2.0)));
}

void main() {
    vec3 finalLight = vec3(0.0);

    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i == uNLights) break;
        LightInfo light = uLights[i];

        vec3 normal = normalize(fNormal);

        vec3 lightDirection;
        if (light.position.w == 0.0)
            lightDirection = normalize(light.position.xyz);
        else
            lightDirection = normalize(light.position.xyz - fPos);

        vec3 ambient = uMaterial.Ka * light.ambient;

        float diffuseFactor = max(dot(lightDirection, normal), 0.0);
        vec3 diffuse = uMaterial.Kd * light.diffuse * diffuseFactor;

        vec3 cameraDirection = normalize(-fPos);
        vec3 reflectedLight = reflect(-lightDirection, normal);

        float specularFactor = pow(max(dot(cameraDirection, reflectedLight), 0.0), uMaterial.shininess);
        vec3 specular = uMaterial.Ks * light.specular * specularFactor;

        float attenuation = attenuate(distance(light.position.xyz, fPos));

        if (dot(lightDirection, normal) < 0.0) {
            specular = vec3(0.0);
        }

        vec3 sumLight = ambient + attenuation * (diffuse + specular);
        float spotCos = dot(lightDirection, normalize(-light.axis));

        if (spotCos > cos(light.aperture))
            finalLight += max(sumLight * pow(abs(spotCos), light.cutoff), 0.0);
    }

    gl_FragColor = vec4(finalLight, 0.0);
}