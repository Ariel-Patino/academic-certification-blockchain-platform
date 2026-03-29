# Troubleshooting y Operacion Local

Fecha de actualizacion: 29 de marzo de 2026

Este documento resume problemas operativos frecuentes al trabajar en local con contracts, backend y frontend.

## 1. Secuencia recomendada de arranque

Orden sugerido:

1. Levantar MongoDB.
2. Compilar contratos.
3. Levantar backend.
4. Levantar frontend.

Comandos habituales:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7

cd contracts && npm install && npm run compile
cd ../backend && npm install && npm run dev
cd ../frontend && npm install && npm run dev
```

## 2. El backend no arranca por puerto ocupado

Sintoma tipico:

```text
Error: listen EADDRINUSE: address already in use :::3001
```

Causa:

- otro proceso Node ya esta escuchando en el puerto 3001

Diagnostico:

```bash
lsof -i :3001 -P -n
```

Solucion:

```bash
kill -TERM <PID>
```

Alternativa:

- cambiar `PORT` en `backend/.env`

## 3. El frontend no encuentra la API

Sintomas comunes:

- errores de fetch
- pantallas sin datos
- historial vacio pese a backend levantado

Revisar:

- `NEXT_PUBLIC_API_URL` en `frontend/.env.local`
- backend realmente operativo en `http://localhost:3001/health`

Valor local esperado:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 4. MetaMask conectada pero red incorrecta

Sintoma tipico:

- no permite invalidar
- no permite operaciones del emisor
- banner indicando red incorrecta

Red esperada:

- Polygon Amoy
- chainId `80002`

Revisar en frontend:

- `NEXT_PUBLIC_AMOY_RPC_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`

## 5. Error al compilar contratos por version de solc

Sintoma tipico:

```text
Truffle is currently using solc 0.8.20, but one or more of your contracts specify pragma solidity ^0.8.21
```

Solucion:

- alinear la version de `solc` en `contracts/truffle-config.js` con los `pragma` de los contratos

Estado actual esperado:

- Truffle compilando con `0.8.21`

## 6. El listener blockchain muestra errores de back-fill

Sintoma tipico:

```text
Back-fill failed (non-fatal): eth_getLogs requests with up to a 10 block range
```

Causa:

- limite del plan Free del proveedor RPC al consultar muchos bloques con `eth_getLogs`

Impacto:

- normalmente no tumba el backend
- el servidor puede seguir operativo aunque falle el back-fill historico

Opciones:

- usar un proveedor con limites mas amplios
- implementar consultas por tramos pequenos si se quiere robustecer el listener

## 7. La verificacion cliente falla por direccion de contrato faltante

Sintoma tipico:

- errores en verificacion por archivo o hash del lado cliente
- revocacion bloqueada desde frontend

Causa habitual:

- falta `NEXT_PUBLIC_CONTRACT_ADDRESS`

Valor esperado:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

## 8. MongoDB no responde

Sintomas comunes:

- el backend no termina de arrancar
- fallan persistencia, historial o sincronizacion off-chain

Verificar:

```bash
docker ps
```

Variables backend correctas:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
```

Nota:

- los nombres validos son `MONGO_URI` y `MONGO_DATABASE_NAME`

## 9. Se borraron build o coverage y algo deja de funcionar

Esto es normal si aun no regeneraste artefactos.

Regeneracion por modulo:

```bash
cd contracts && npm run compile
cd backend && npm run build
cd frontend && npm run build
```

Notas:

- `npm install` solo instala dependencias
- no regenera por si mismo `build`, `dist` o reportes de cobertura

## 10. El backend en desarrollo y produccion no arrancan igual

Diferencia importante:

- desarrollo: `npm run dev`
- produccion local: `npm run build && npm start`

Si ejecutas `npm start` sin `build` previo, faltara `dist/server.js`.

## 11. Validaciones rapidas recomendadas

Backend:

```bash
cd backend
npm run build
npm test
```

Frontend:

```bash
cd frontend
npm run build
npm test
```

Contratos:

```bash
cd contracts
npm run compile
npm run test
```

Salud del backend:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/architecture
```

## 12. Checklist minima antes de demo

- MongoDB arriba.
- Contratos compilados.
- Backend con variables correctas.
- Frontend con `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_CONTRACT_ADDRESS` correctos.
- MetaMask conectada a Polygon Amoy.
- Emisor autorizado on-chain.
- Endpoint `/health` respondiendo.
- Endpoint `/api/architecture` sin fallos criticos.