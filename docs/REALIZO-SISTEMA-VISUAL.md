# Sistema visual Realizo — interfaz premium

## Dirección de diseño (aprobada por el usuario)

**Simple, elegante, premium, fácil de entender y visualmente distinta a los prototipos anteriores.**
No usar una pantalla negra con un formulario oscuro genérico como identidad principal.
No llenar las pantallas con explicaciones técnicas, avisos largos o mensajes repetitivos.

## Paleta de marca

- Fondo editorial marfil: `#F7F3EE`
- Tinta berenjena: `#261E3F`
- Texto profundo: `#251D37`
- Violeta principal (CTA): `#6E4BD2`
- Lila suave: `#E9DDFE`
- Coral acento: `#FFAE9C`
- Rosa cálido: `#F469A6`
- Menta acento: `#BDF9CD`

Reservar violeta para acciones principales y coral/menta para detalles memorables; evitar
excesos de gradientes, neón indiscriminado o efectos de cristal en todos los paneles.
Contrastes accesibles; priorizar legibilidad.

## Componentes

- Marca: símbolo editorial de fotograma/play con geometría propia, NO un emoji triangular.
- Iconos: SVG personalizados o biblioteca consistente; contorno equilibrado de 1.8–2px,
  extremos redondeados, colores de acento; no combinar estilos incompatibles.
- Formularios: una única acción clara por pantalla, superficies marfil, campo amplio,
  etiquetas cortas, estados accesibles y teclado móvil compatible.
- Botones: estilo violeta primario, Google blanco con icono multicolor, bordes suaves.
- Responsivo: panel editorial visual en escritorio; formulario priorizado en móviles.
- Copys: máximo una frase de apoyo, mensajes de error de una línea. No presentar
  términos como Worker, Sandbox, D1, JWT o OAuth a clientes.
- Seguridad: acciones sin proveedor configurado deben deshabilitarse; nunca simular
  inicio de sesión ni mostrar un éxito falso.

## Aplicación progresiva

1. `/login`: primera pantalla de referencia, ya diseñada.
2. `/wallet`: conservar precisión de saldos y botones PayPal, adaptar estilos.
3. `/create`: mostrar modelos, tarifa por generación, campo de prompt y estado,
   con el mismo sistema de color e iconografía.
4. Historial de videos, cuenta, perfil y configuraciones: misma línea gráfica.

No desplegar cambios en producción sin autorización del usuario.
