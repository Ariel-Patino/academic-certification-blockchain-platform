# Diagramas Ilustrados (Mermaid)

Fecha de actualización: 29 de marzo de 2026

Este documento contiene una versión visual de los flujos con estilo tipo "dibujitos" (bloques, colores y carriles por rol).

## Recomendación de visualización

Para ver estos diagramas con mejor calidad, se recomienda abrir este archivo en una app Markdown con motor Mermaid dedicado.

- Windows: Typedown (recomendado).
- macOS: equivalente con soporte Mermaid (por ejemplo, Mark Text, Typora o Mermaid Chart).

Nota: en algunos navegadores y en la vista previa de VS Code el render puede verse con estilos incompletos o menos legibles.

## 1) Mapa visual de la aplicación

```mermaid
flowchart LR
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111,stroke-width:1px;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111,stroke-width:1px;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111,stroke-width:1px;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111,stroke-width:1px;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111,stroke-width:1px;

  U[Usuario / Emisor]:::user --> FE[Frontend Next.js]:::fe
  FE --> BE[Backend API Express]:::be
  BE --> SC[Smart Contract AcademicCertification]:::bc
  BE --> DB[(MongoDB)]:::db
  FE --> V[Vista Verificar]:::fe
  FE --> I[Vista Emitir]:::fe
  FE --> R[Vista Revocar]:::fe
  FE --> H[Vista Historial Paginado]:::fe
```

## 2) Emisión individual (swimlanes)

```mermaid
flowchart TB
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111;

  subgraph L1[Carril Emisor]
    A1[Completa formulario]:::user
    A2[Confirma emision]:::user
  end

  subgraph L2[Carril Frontend]
    B1[Valida campos]:::fe
    B2[Envia solicitud POST]:::fe
    B3[Muestra codigo + estado]:::fe
  end

  subgraph L3[Carril Backend]
    C1[Valida negocio]:::be
    C2[Construye payload canónico]:::be
    C3[Prepara registro]:::be
    C4[Respuesta a frontend]:::be
  end

  subgraph L4[Infraestructura]
    D1[Registrar en smart contract]:::bc
    D2[(Guardar en MongoDB)]:::db
  end

  A1 --> A2 --> B1 --> B2 --> C1 --> C2 --> C3
  C3 --> D1 --> D2 --> C4 --> B3
```

## 3) Emisión por lote (con decisiones)

```mermaid
flowchart TD
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef err fill:#ffe0e0,stroke:#b71c1c,color:#111;

  U1[Cargar CSV]:::user --> FE1[Validar formato CSV]:::fe
  FE1 --> Q1{CSV valido?}
  Q1 -->|No| E1[Mostrar errores de formato]:::err
  Q1 -->|Si| FE2[Enviar lote]:::fe
  FE2 --> BE1[Procesar registro por registro]:::be
  BE1 --> Q2{Registro valido?}
  Q2 -->|No| E2[Marcar registro con error]:::err
  Q2 -->|Si| BE2[Emitir + persistir]:::be
  E2 --> BE3[Agregar al resumen]:::be
  BE2 --> BE3
  BE3 --> Q3{Quedan registros?}
  Q3 -->|Si| BE1
  Q3 -->|No| FE3[Mostrar resultados del lote]:::fe
```

## 4) Verificación (código o archivo)

```mermaid
flowchart LR
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;

  U[Usuario]:::user --> M{Metodo}:::fe
  M -->|Codigo| FE1[Ingresar codigo]:::fe
  M -->|Archivo| FE2[Cargar certificado]:::fe

  FE1 --> BE1[Consultar estado]:::be
  FE2 --> FE3[Validar estructura archivo]:::fe
  FE3 --> BE1

  BE1 --> SC[Consultar estado on-chain]:::bc
  SC --> BE2[Construir resultado]:::be
  BE2 --> FE4[Mostrar vigente/revocado/expirado]:::fe
```

## 5) Revocación

```mermaid
flowchart TB
  classDef user fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef bc fill:#f3e8ff,stroke:#6a1b9a,color:#111;
  classDef db fill:#ffe8e8,stroke:#c62828,color:#111;

  U1[Emisor indica ID + motivo]:::user --> FE1[Valida sesion y red]:::fe
  FE1 --> BC1[Firma y envia revocacion]:::bc
  BC1 --> FE2[Recibe txHash]:::fe
  FE2 --> BE1[Solicita estado actualizado]:::be
  BE1 --> BC2[Consulta estado revocado]:::bc
  BC2 --> DB1[(Actualiza estado en MongoDB)]:::db
  DB1 --> FE3[Mostrar revocacion exitosa]:::fe
```

## 6) Historial paginado

```mermaid
flowchart TD
  classDef fe fill:#dff3ff,stroke:#1b6ca8,color:#111;
  classDef be fill:#e9ffe6,stroke:#2e7d32,color:#111;
  classDef ui fill:#fff4cc,stroke:#b38f00,color:#111;

  FE1[Abrir registro historico]:::fe --> BE1[GET certificados por emisor]:::be
  BE1 --> FE2[Render tabla]:::fe
  FE2 --> UI1[Selector por pagina: 10/25/50/100]:::ui
  FE2 --> UI2[Anterior]:::ui
  FE2 --> UI3[Siguiente]:::ui

  UI1 --> FE3[Recalcular paginas y volver a pagina 1]:::fe
  UI2 --> Q1{Pagina > 1?}
  UI3 --> Q2{Pagina < total?}
  Q1 -->|Si| FE4[Pagina anterior]:::fe
  Q1 -->|No| FE5[Quedar en primera]:::fe
  Q2 -->|Si| FE6[Pagina siguiente]:::fe
  Q2 -->|No| FE7[Quedar en ultima]:::fe
```

## 7) Mapa de pruebas y cobertura

```mermaid
flowchart LR
  classDef dev fill:#fff4cc,stroke:#b38f00,color:#111;
  classDef rep fill:#dff3ff,stroke:#1b6ca8,color:#111;

  D[Desarrollo]:::dev --> T1[Backend unit tests]:::rep
  D --> T2[Frontend unit tests]:::rep
  D --> T3[Backend coverage]:::rep
  D --> T4[Frontend coverage]:::rep
  D --> T5[Contracts coverage]:::rep
```

Comandos:

- backend unit test: npm test
- frontend unit test: npm test
- backend coverage: npm run test:coverage
- frontend coverage: npm run test:coverage
- contracts coverage: npm run hh:coverage
