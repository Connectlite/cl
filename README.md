# Postlinkss (local dev)

Projeto mínimo criado para permitir execução local do app React.

Como usar:

1. Instale dependências:

```bash
cd /workspaces/cl
npm install
```

2. Rode em modo desenvolvimento:

```bash
npm run dev
```

Observações / próximos passos:
- A versão original do componente React estava salva em `index.html` (conteúdo JSX). Isso causava erros porque o arquivo tinha extensão `.html` porém continha JSX. Eu movi a aplicação para `src/App.jsx` com uma versão mínima que inicia corretamente.
- Se desejar que eu porte o componente completo e ajuste integração com Firebase (variáveis `__firebase_config`, `__app_id`), diga e eu faço a migração completa e as correções necessárias.
# cl