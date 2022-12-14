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
    vec3 Ka; // ambient
    vec3 Kd; // diffuse
    vec3 Ks; // specular
    float shininess; // brilho do objeto
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
    // reduz a intensidade da luz em funçao da distancia da posiçao
    // da luz ate ao fragmento
    return min(1.0, 1.0 / (0.1 + 0.01 * dist + 0.001 * dist * dist));
}

vec3 determineLight(LightInfo light, vec3 normal, vec3 lightDirection) {
    vec3 ambient = uMaterial.Ka * light.ambient;

    // produto escalar da direçao da luz de cada fragmento
    // e a sua normal, determina como cada fragmento deve ser iluminado 
    float diffuseFactor = max(dot(lightDirection, normal), 0.0);
    vec3 diffuse = uMaterial.Kd * light.diffuse * diffuseFactor;

    // queremos o vetor normalizado a apontar da superficie para o olho
    vec3 cameraDirection = normalize(-fPos);
    // reflexao da luz na superficie
    vec3 reflectedLight = reflect(-lightDirection, normal);

    // cosseno entre vetor cameradirection e reflected
    // light elevado a material shininess
    float specularFactor = pow(max(dot(cameraDirection, reflectedLight), 0.0), uMaterial.shininess);
    vec3 specular = uMaterial.Ks * light.specular * specularFactor;

    if (dot(lightDirection, normal) < 0.0)
        specular = vec3(0.0);
    
    // distancia entre pos da luz e pos do fragmento
    float attenuation = attenuate(distance(light.position.xyz, fPos));

    return ambient + attenuation * (diffuse + specular);
}

void main() {
    vec3 finalLight = vec3(0.0);

    // garante que fNormal fica uma normal com comprimento 1
    vec3 normal = normalize(fNormal);

    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i == uNLights) break;

        LightInfo light = uLights[i];

        vec3 lightDirection;
        if (light.position.w == 0.0)
            lightDirection = normalize(light.position.xyz);
        else
            lightDirection = normalize(light.position.xyz - fPos);

        // cosseno entre a direçao da luz e o eixo da luz spotlight
        float spotCos = dot(lightDirection, normalize(-light.axis));

        // light.aperture = abertura do spotlight
        // o fragmento não é iluminado se estiver fora
        // do cone do spotlight
        // (light.apertura = PI => todos os fragmentos são iluminados)
        if (spotCos < cos(light.aperture)) continue;

        // soma entre componente ambiente e multiplicaçao entre atenuaçao
        // da difusa e especular
        vec3 sumLight = determineLight(light, normal, lightDirection);

        // soma-se 1 e divide-se por 2 para manter
        // os valores de spotcos entre 0 e 1
        float effectiveCutoff = pow((spotCos + 1.0) / 2.0, light.cutoff);
        
        // soma de todas as luzes, cada luz e multiplicada
        // pelo cutoff efetivo
        finalLight += sumLight * effectiveCutoff;
    }

    gl_FragColor = vec4(finalLight, 0.0);
}