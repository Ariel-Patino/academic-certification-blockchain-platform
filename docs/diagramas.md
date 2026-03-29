# Diagramas de Flujos de la Aplicación

Fecha de actualización: 29 de marzo de 2026

Este documento incluye los flujos funcionales principales de la aplicación con actores, entidades y decisiones.

Versión visual ilustrada: ver docs/diagramas-ilustrados.md

Diagramas estructurales del certificado: ver docs/certificate-model-diagrams.md

Recomendación de visualización: para mejor render Mermaid, abrir docs/diagramas-ilustrados.md en una app dedicada (Windows: Typedown; macOS: Mark Text, Typora o Mermaid Chart). En navegador o vista previa de VS Code puede verse menos legible.

## Entidades y actores

- Usuario verificador
- Emisor
- Frontend (Next.js)
- Backend API (Express)
- Smart Contract AcademicCertification (ERC-721)
- MongoDB
- Red blockchain

## 1) Mapa general de navegación

```mermaid
flowchart TD
	A[Inicio] --> B[Emitir titulo]
	A --> C[Emision por lote]
	A --> D[Verificar certificado]
	A --> E[Revocar certificado]
	A --> F[Registro historico]

	B --> B1[Formulario de emision individual]
	C --> C1[Carga CSV y procesamiento]
	D --> D1[Verificar por codigo]
	D --> D2[Verificar por archivo]
	E --> E1[Validar sesion de emisor]
	F --> F1[Listado paginado]
```

## 2) Flujo de autenticación del emisor

```mermaid
sequenceDiagram
	actor Emisor
	participant FE as Frontend
	participant BE as Backend API
	participant BC as Blockchain

	Emisor->>FE: Conectar billetera
	FE->>BE: Solicitar nonce de autenticacion
	BE-->>FE: Nonce + mensaje
	Emisor->>FE: Firmar mensaje
	FE->>BE: Enviar firma para verificacion
	BE->>BC: Validar estado del emisor
	BC-->>BE: Emisor autorizado
	BE-->>FE: Token de sesion
	FE-->>Emisor: Sesion activa
```

## 3) Flujo de emisión individual

```mermaid
sequenceDiagram
	actor Emisor
	participant FE as Frontend
	participant BE as Backend API
	participant DB as MongoDB
	participant SC as Smart Contract

	Emisor->>FE: Completar formulario de emision
	FE->>BE: POST emision de certificado
	BE->>BE: Validar datos
	BE->>SC: Registrar certificado en cadena
	SC-->>BE: certificateId + txHash
	BE->>DB: Persistir documento y metadatos
	DB-->>BE: Confirmacion
	BE-->>FE: Resultado de emision
	FE-->>Emisor: Mostrar codigo, estado y comprobante
```

## 4) Flujo de emisión por lote

```mermaid
flowchart TD
	A[Emisor carga CSV] --> B[Frontend valida formato]
	B -->|Valido| C[Enviar lote al backend]
	B -->|Invalido| B1[Mostrar errores de archivo]

	C --> D[Backend procesa cada registro]
	D --> E[Validar datos del registro]
	E -->|OK| F[Emitir en smart contract]
	E -->|Error| G[Marcar registro con error]

	F --> H[Persistir en MongoDB]
	H --> I[Agregar resultado al resumen]
	G --> I

	I --> J{Quedan registros?}
	J -->|Si| D
	J -->|No| K[Responder resumen del lote]
	K --> L[Frontend muestra tabla de resultados]
```

## 5) Flujo de verificación por código

```mermaid
sequenceDiagram
	actor Usuario as Usuario verificador
	participant FE as Frontend
	participant BE as Backend API
	participant SC as Smart Contract

	Usuario->>FE: Ingresar codigo de verificacion
	FE->>BE: GET verificacion por codigo
	BE->>SC: Consultar estado del certificado
	SC-->>BE: Vigente / Revocado / Expirado
	BE-->>FE: Resultado de verificacion
	FE-->>Usuario: Mostrar autenticidad y estado
```

## 6) Flujo de verificación por archivo

```mermaid
flowchart TD
	A[Usuario carga archivo de certificado] --> B[Frontend valida estructura]
	B -->|Valida| C[Extraer codigo de verificacion]
	B -->|Invalida| B1[Mostrar error de formato]

	C --> D[Consultar estado con codigo]
	D --> E[Comparar integridad del documento]
	E -->|Coincide| F[Resultado valido]
	E -->|No coincide| G[Resultado no valido]

	F --> H[Mostrar estado final al usuario]
	G --> H
```

## 7) Flujo de revocación

```mermaid
sequenceDiagram
	actor Emisor
	participant FE as Frontend
	participant SC as Smart Contract
	participant BE as Backend API
	participant DB as MongoDB

	Emisor->>FE: Ingresar ID y motivo oficial
	FE->>SC: Ejecutar revocacion firmada
	SC-->>FE: txHash de revocacion
	FE->>BE: Notificar/consultar nuevo estado
	BE->>SC: Confirmar estado revocado
	SC-->>BE: Estado revocado
	BE->>DB: Actualizar estado del certificado
	BE-->>FE: Confirmacion final
	FE-->>Emisor: Mostrar revocacion exitosa
```

## 8) Flujo de registro histórico paginado

```mermaid
flowchart TD
	A[Emisor abre registro historico] --> B[Frontend solicita certificados por emisor]
	B --> C[Backend responde listado]
	C --> D[Frontend calcula paginacion]

	D --> E[Mostrar pagina actual]
	E --> F[Selector: 10 / 25 / 50 / 100]
	E --> G[Boton Anterior]
	E --> H[Boton Siguiente]

	F --> I[Recalcular total de paginas]
	I --> E

	G --> J{Pagina actual > 1?}
	J -->|Si| K[Ir a pagina anterior]
	J -->|No| L[Mantener en primera pagina]
	K --> E
	L --> E

	H --> M{Pagina actual < total?}
	M -->|Si| N[Ir a pagina siguiente]
	M -->|No| O[Mantener en ultima pagina]
	N --> E
	O --> E
```

## 9) Flujo de manejo de errores en UI

```mermaid
flowchart TD
	A[Usuario ejecuta accion] --> B{Respuesta exitosa?}
	B -->|Si| C[Mostrar resultado y estado]
	B -->|No| D{Tipo de error}

	D --> E[Validacion de datos]
	D --> F[Sesion no valida]
	D --> G[Red o nodo no disponible]
	D --> H[Error de transaccion]

	E --> I[Mostrar mensaje y permitir correccion]
	F --> J[Solicitar reconexion y nueva autenticacion]
	G --> K[Mostrar aviso y reintentar]
	H --> L[Mostrar detalle y mantener trazabilidad]
```

## 10) Flujo de cobertura y pruebas unitarias

```mermaid
flowchart LR
	A[Desarrollador] --> B[Ejecutar unit tests backend]
	A --> C[Ejecutar unit tests frontend]
	A --> D[Ejecutar coverage backend]
	A --> E[Ejecutar coverage frontend]
	A --> F[Ejecutar coverage contratos]

	B --> G[Reporte de pruebas]
	C --> G
	D --> H[Reporte de cobertura]
	E --> H
	F --> H
```

Comandos asociados:

- backend unit test: npm test
- frontend unit test: npm test
- backend coverage: npm run test:coverage
- frontend coverage: npm run test:coverage
- contracts coverage: npm run hh:coverage
