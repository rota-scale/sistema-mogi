// O painel importa o mesmo worker com "?url". Com o sufixo, o endereço fica
// só no pacote do morador e não vai parar no pedaço dividido com o painel.
declare module '*?url&morador' {
  const endereco: string
  export default endereco
}
