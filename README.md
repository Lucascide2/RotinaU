O RotinaU é uma ferramenta web de planejamento de estudos. O estudante informa os períodos em que realmente pode estudar, adiciona as disciplinas cursadas, define a dificuldade ou prioridade de cada uma e escolhe a duração desejada das sessões. A ferramenta então apresenta uma sugestão semanal de distribuição do tempo, com gamificação incluída.

O aplicativo pode ser utilizado a partir do .apk disponibilizado no <link-do-apk> ou pode-se construir um apk a partir do processo abaixo:

# Pré-requisitos

Antes de executar o projeto, certifique-se de que os seguintes programas estão instalados:

* [Bun](https://bun.sh/)
* Git
* Node.js, caso alguma ferramenta auxiliar do projeto exija sua presença

> **Importante:** o projeto utiliza o Bun como gerenciador de dependências. O arquivo `bun.lock` está incluído no repositório para garantir a instalação das versões esperadas das dependências.

## Verificando as instalações

Abra um terminal e execute:

```bash
bun --version
```

e:

```bash
git --version
```

Se os comandos retornarem as respectivas versões, o ambiente está pronto.

---

# 1. Clonar o projeto

No terminal, navegue até o diretório onde deseja armazenar o projeto e execute:

```bash
git clone https://github.com/Lucascide2/RotinaU.git
```

Depois, entre no diretório do projeto:

```bash
cd RotinaU
```

Substitua `URL_DO_REPOSITORIO` e `NOME_DO_REPOSITORIO` pelas informações do repositório disponibilizado no GitHub.

Exemplo:

```bash
git clone https://github.com/Lucascide2/RotinaU.git
cd rotinau
```

---

# 2. Instalar as dependências

Dentro do diretório do projeto, execute:

```bash
bun install
```

Esse comando instala automaticamente as dependências especificadas no `package.json`.

O Bun também utilizará o arquivo:

```text
bun.lock
```

para instalar as versões correspondentes às dependências registradas no projeto.

---

# 3. Executar o projeto em modo de desenvolvimento

Após instalar as dependências, execute:

```bash
bun run dev
```

O terminal exibirá um endereço local semelhante a:

```text
Local: http://localhost:3000/
```

Abra o endereço indicado no navegador.

A aplicação será executada localmente em modo de desenvolvimento.

> A porta pode variar dependendo da configuração do projeto ou de outras aplicações que estejam utilizando a mesma porta.

---

# 4. Gerar o build da aplicação

Para gerar a versão de produção, execute:

```bash
bun run build
```

Esse comando utiliza o Vite/TanStack Start para compilar a aplicação.

Se o processo for concluído sem erros, o projeto estará compilado para produção.

---

# 5. Testar a versão de produção

Depois de gerar o build, pode ser utilizado o comando:

```bash
bun run preview
```

O terminal fornecerá um endereço local para visualizar a versão compilada.

Abra esse endereço no navegador para verificar o resultado do build.

---

# 7. Gerando um executável

## Aplicação web

O projeto disponibilizado atualmente é uma aplicação web baseada em React, TypeScript, TanStack Start e Vite.

Portanto, o comando:

```bash
bun run build
```

gera a versão compilada da aplicação web. Ele **não gera diretamente um arquivo `.exe` ou `.apk`**.

A aplicação pode ser executada em um navegador ou hospedada em um servidor compatível com a configuração do TanStack Start.

## Aplicativo Android (APK)

Caso seja necessário disponibilizar o RotinaU como um aplicativo Android (`.apk`), será necessário adicionar uma camada de empacotamento, como o Capacitor.

A arquitetura pode ser representada da seguinte maneira:

```text
React + TypeScript
        ↓
   TanStack Start
        ↓
       Vite
        ↓
    Capacitor
        ↓
    Android
        ↓
      .apk
```

Essa etapa exige configuração adicional do ambiente Android, incluindo Android Studio, Android SDK e ferramentas de compilação.


