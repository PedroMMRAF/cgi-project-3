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
    vec3 Ka;//ambient
    vec3 Kd;//diffuse
    vec3 Ks;//specular
    float shininess;//brilho do objeto
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
    return min(1.0, 1.0 / (0.1 + 0.01 * dist + 0.001 * pow(dist, 2.0)));//reduz a intensidade da luz em funçao da distancia da posiçao da luz ate ao fragmento
    //so afeta a componente difusa e especular da luz
}

void main() {
    vec3 finalLight = vec3(0.0);

    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i == uNLights) break;
        LightInfo light = uLights[i];

        vec3 normal = normalize(fNormal);// garante que fNormal fica uma normal com comprimento 1

        vec3 lightDirection;
        if (light.position.w == 0.0)
            lightDirection = normalize(light.position.xyz);
        else
            lightDirection = normalize(light.position.xyz - fPos);

        vec3 ambient = uMaterial.Ka * light.ambient;

        float diffuseFactor = max(dot(lightDirection, normal), 0.0);//produto escalar da direçao da luz de cada fragmento e a sua normal, determina como cada fragmento deve ser iluminado 
        vec3 diffuse = uMaterial.Kd * light.diffuse * diffuseFactor;

        vec3 cameraDirection = normalize(-fPos);//queremos o vetor normalizado a apontar da superficie para o olho
        vec3 reflectedLight = reflect(-lightDirection, normal);// reflexao da luz na superficie

        float specularFactor = pow(max(dot(cameraDirection, reflectedLight), 0.0), uMaterial.shininess);//cosseno entre vetor cameradirection e reflected light elevado a material shininess
        vec3 specular = uMaterial.Ks * light.specular * specularFactor;

        if (dot(lightDirection, normal) < 0.0)
            specular = vec3(0.0);
            
        float attenuation = attenuate(distance(light.position.xyz, fPos));//distancia entre pos da luz e pos do fragmento


        vec3 sumLight = ambient + attenuation * (diffuse + specular);//soma entre componente ambiente e multiplicaçao entre atenuaçao da difusa e especular
        float spotCos = dot(lightDirection, normalize(-light.axis));//cosseno entre a direçao da luz e o eixo da luz spotlight

        if (spotCos > cos(light.aperture))//light.aperture = abertura do spotlight
            finalLight += max(sumLight * pow((spotCos + 1.0) / 2.0, light.cutoff), 0.0);//soma de todas as luzes(cada luz e multiplicada por spotcos elevado a cutoff), soma-se 1 e divide-se por 2 para manter os valores de spotcos entre 0 e 1
    }

    gl_FragColor = vec4(finalLight, 0.0);
}