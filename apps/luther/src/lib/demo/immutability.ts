/**
 * Dados de demonstração do layout do editor.
 * Trecho real do acervo (content/sermons/en-US/c_h_spurgeon/0001.md, domínio público);
 * a tradução pt-BR e as threads são ilustrativas. Serão substituídos pelo Supabase na etapa 2.
 */
import type { CommentThread, Person, Segment, WorkHeader } from "@/components/editor/types"

export const people: Person[] = [
  { id: "me", name: "Você" },
  { id: "ana", name: "Ana Ribeiro" },
  { id: "davi", name: "Davi Moura" },
]

export const work: WorkHeader = {
  id: "spurgeon-0001",
  title: "The Immutability of God",
  author: "C. H. Spurgeon",
  type: "Sermão",
  date: "7 de janeiro de 1855",
  source: "biblebb.com/files/spurgeon/0001.txt",
  language: "pt-BR",
  version: 1,
}

export const segments: Segment[] = [
  {
    id: "s-title",
    kind: "title",
    source: "The Immutability of God",
    target: "A Imutabilidade de Deus",
    stage: "approved",
  },
  {
    id: "s-desc",
    kind: "description",
    source: "A sermon on Malachi 3:6, preached at New Park Street Chapel.",
    target: "Sermão sobre Malaquias 3:6, pregado na capela de New Park Street.",
    stage: "review",
  },
  {
    id: "s-1",
    kind: "paragraph",
    source:
      "It has been said by some one that “the proper study of mankind is man.” I will not oppose the idea, but I believe it is equally true that the proper study of God’s elect is God; the proper study of a Christian is the Godhead. The highest science, the loftiest speculation, the mightiest philosophy, which can ever engage the attention of a child of God, is the name, the nature, the person, the work, the doings, and the existence of the great God whom he calls his Father.",
    target:
      "Já se disse que “o estudo próprio da humanidade é o homem”. Não me oporei a essa ideia, mas creio ser igualmente verdadeiro que o estudo próprio dos eleitos de Deus é Deus; o estudo próprio de um cristão é a Divindade. A mais alta ciência, a mais elevada especulação, a mais poderosa filosofia que jamais poderá ocupar a atenção de um filho de Deus é o nome, a natureza, a pessoa, a obra, os feitos e a existência do grande Deus a quem ele chama de Pai.",
    stage: "approved",
  },
  {
    id: "s-2",
    kind: "paragraph",
    source:
      "There is something exceedingly improving to the mind in a contemplation of the Divinity. It is a subject so vast, that all our thoughts are lost in its immensity; so deep, that our pride is drowned in its infinity. Other subjects we can compass and grapple with; in them we feel a kind of self-content, and go our way with the thought, “Behold I am wise.” But when we come to this master-science, finding that our plumb-line cannot sound its depth, and that our eagle eye cannot see its height, we turn away with the thought, that vain man would be wise, but he is like a wild ass’s colt; and with the solemn exclamation, “I am but of yesterday, and know nothing.”",
    target:
      "Há algo extremamente edificante para a mente na contemplação da Divindade. É um assunto tão vasto que todos os nossos pensamentos se perdem em sua imensidão; tão profundo que o nosso orgulho se afoga em sua infinitude. Outros assuntos podemos abarcar e dominar; neles sentimos uma espécie de contentamento próprio e seguimos nosso caminho pensando: “Eis que sou sábio”. Mas, quando chegamos a esta ciência-mestra, descobrindo que nosso prumo não consegue sondar sua profundidade e que nosso olho de águia não alcança sua altura, afastamo-nos com o pensamento de que o homem vão quer ser sábio, mas é como a cria do jumento selvagem; e com a solene exclamação: “Sou de ontem e nada sei”.",
    stage: "review",
  },
  {
    id: "s-3",
    kind: "paragraph",
    source:
      "No subject of contemplation will tend more to humble the mind, than thoughts of God. We shall be obliged to feel—",
    target:
      "Nenhum assunto de contemplação tenderá mais a humilhar a mente do que os pensamentos sobre Deus. Seremos obrigados a sentir:",
    stage: "translation",
  },
  {
    id: "s-4",
    kind: "quote",
    source: "Great God, how infinite art thou,\nWhat worthless worms are we!",
    target: "Grande Deus, quão infinito és tu,\nQue vermes indignos somos nós!",
    stage: "discussion",
  },
  {
    id: "s-5",
    kind: "paragraph",
    source:
      "But while the subject humbles the mind it also expands it. He who often thinks of God, will have a larger mind than the man who simply plods around this narrow globe.",
    target:
      "Mas, enquanto o assunto humilha a mente, também a expande. Quem pensa com frequência em Deus terá uma mente mais ampla do que o homem que simplesmente se arrasta por este globo estreito.",
    stage: "translation",
  },
  {
    id: "s-6",
    kind: "paragraph",
    source:
      "Oh, there is, in contemplating Christ, a balm for every wound; in musing on the Father, there is a quietus for every grief; and in the influence of the Holy Ghost, there is a balsam for every sore.",
    target: "",
    stage: "original",
  },
]

function anchor(segmentId: string, side: "source" | "target", quote: string) {
  const seg = segments.find((s) => s.id === segmentId)!
  const text = side === "source" ? seg.source : seg.target
  const start = text.indexOf(quote)
  return { segmentId, side, quote, start, end: start + quote.length }
}

export const threads: CommentThread[] = [
  {
    id: "t-1",
    ...anchor("s-2", "target", "ciência-mestra"),
    status: "open",
    messages: [
      {
        id: "m-1",
        authorId: "ana",
        body: "“Ciência-mestra” soa artificial. Que tal “ciência suprema”? Spurgeon usa *master-science* no sentido de ciência principal.",
        createdAt: "há 2 h",
      },
      {
        id: "m-2",
        authorId: "me",
        body: "“Suprema” perde o eco de “mestra”. Vou pensar numa alternativa.",
        createdAt: "há 40 min",
      },
    ],
  },
  {
    id: "t-2",
    ...anchor("s-4", "target", "Que vermes indignos somos nós!"),
    status: "open",
    messages: [
      {
        id: "m-3",
        authorId: "davi",
        body: "Esse hino (Isaac Watts) tem tradução consagrada em português? Se tiver, devemos usá-la.",
        createdAt: "ontem",
      },
    ],
  },
  {
    id: "t-3",
    ...anchor("s-2", "source", "like a wild ass’s colt"),
    status: "open",
    messages: [
      {
        id: "m-4",
        authorId: "ana",
        body: "Alusão a Jó 11:12. Vale uma nota de rodapé na tradução?",
        createdAt: "ontem",
      },
    ],
  },
  {
    id: "t-4",
    ...anchor("s-1", "target", "Divindade"),
    status: "resolved",
    messages: [
      {
        id: "m-5",
        authorId: "davi",
        body: "*Godhead* → “Divindade”, conforme o glossário.",
        createdAt: "há 3 dias",
      },
    ],
  },
]
