# Diseños propios (techos y más)

Cada archivo `techos/<tipo>.json` reemplaza el techo plano de ese tipo de edificio al exportar
(`casa`, `condominio`, `tienda`, `oficinas`, `comida`, `mansion`, `hospital`, `escuela`... o `todos` para cualquiera).
Si la carpeta `techos/` está vacía, los techos siguen planos. Hay un ejemplo en `ejemplos/casa_dos_aguas.json`:
cópialo a `techos/casa.json` para probarlo.

## Formato
```json
{
  "nombre": "lo que quieras",
  "huella": [ancho, fondo],          // en studs: el rectángulo del techo que diseñaste (eje X, eje Z)
  "alto": "proporcional",            // "proporcional": la altura crece con el techo; "fijo": la altura no cambia
  "partes": [
    { "name": "TechoAgua", "shape": "Wedge", "pos": [x, y, z], "size": [x, y, z], "rot": [x, y, z],
      "color": "techo", "material": "SmoothSurface" }
  ]
}
```
- `pos` es relativa al centro de la huella, con `y = 0` en la parte de arriba de las paredes del último piso.
- `shape`: Block, Wedge, Ball o Cylinder (las mismas piezas de TruWorlds). `rot` en grados (orden Y, X, Z).
- `color`: un color `#rrggbb`, o `"techo"` para usar el tono de techo de cada casa y su barrio.
- Al exportar, el diseño se estira al tamaño de cada techo (cada rectángulo de techo de la casa) y se gira 90° si el techo
  es largo en el otro sentido. Mejor diseñar con giros en Y de 0, 90, 180 o 270.

## Probar a escala chica
```
node ciudad/exportar.js --semilla=7 --zona=200,20,60,60
```
Exporta solo ese pedazo del mapa (en celdas; las coordenadas se ven en el visor) a `ciudad/export/ciudad_semilla_7_zona/`.
