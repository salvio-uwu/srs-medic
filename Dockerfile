# 1. El punto de partida: Necesitamos Node.js
FROM node:20-alpine

# 2. Creamos una carpeta dentro de Docker para tu proyecto
WORKDIR /app

# 3. Copiamos los archivos de "pedidos" (package.json)
# Lo hacemos antes para que Docker no reinstale todo cada vez que cambies un botón
COPY package*.json ./

# 4. Instalamos las herramientas (Tailwind, Vite, React, etc.)
RUN npm install

# 5. Ahora sí, metemos todo tu código (src, public, configs...)
COPY . .

# 6. Avisamos que usaremos el puerto 5173 (el de Vite)
EXPOSE 5173

# 7. El comando para encender los motores
CMD ["npm", "run", "dev", "--", "--host"]
