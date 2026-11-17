import type { Book } from "./types";

type SampleTitle = [title: string, author: string, description: string, category: string, isbn: string, rating: number, copies: number];

const titles: SampleTitle[] = [
  ["The Hobbit", "J.R.R. Tolkien", "A homebody sets out on an unexpected quest through a world of dragons, dwarves, and courage.", "Fantasy", "9780547928227", 4.8, 2],
  ["Pride and Prejudice", "Jane Austen", "Elizabeth Bennet and Mr. Darcy discover that first impressions are not always the truest ones.", "Romance", "9780141439518", 4.7, 2],
  ["Dune", "Frank Herbert", "On a desert planet, a young heir is drawn into a struggle for power, survival, and the future.", "Sci-Fi", "9780441172719", 4.6, 1],
  ["The Midnight Library", "Matt Haig", "A woman explores the many lives she might have lived, and what makes one worth choosing.", "Fiction", "9780525559474", 4.4, 2],
  ["The Silent Patient", "Alex Michaelides", "A therapist becomes determined to understand why a celebrated painter stopped speaking.", "Horror", "9781250301697", 4.3, 1],
  ["Atomic Habits", "James Clear", "A practical guide to making small, steady changes that add up to meaningful progress.", "Educational", "9780735211292", 4.6, 2],
  ["Educated", "Tara Westover", "A memoir about family, self-invention, and the power of learning to see the world anew.", "Non-Fiction", "9780399590504", 4.5, 1],
  ["Harry Potter and the Sorcerer's Stone", "J.K. Rowling", "A boy discovers a magical school and a world that will change his life forever.", "Children's Books", "9780590353427", 4.8, 3],
  ["Sapiens", "Yuval Noah Harari", "A wide-ranging look at the stories and revolutions that shaped human civilization.", "History", "9780062316097", 4.5, 1],
  ["The Book Thief", "Markus Zusak", "A young girl finds comfort in words and friendship in a town facing wartime hardship.", "Fiction", "9780375842207", 4.7, 1],
  ["The Alchemist", "Paulo Coelho", "A shepherd follows a recurring dream on a journey toward purpose and discovery.", "Fiction", "9780062315007", 4.4, 2],
  ["A Brief History of Time", "Stephen Hawking", "An inviting tour of some of the biggest questions about the universe and time.", "Educational", "9780553380163", 4.3, 1],
  ["The Three Musketeers", "Alexandre Dumas", "A young swordsman joins three loyal companions for a swashbuckling adventure in France.", "Action", "9780140449266", 4.6, 2],
  ["The Bourne Identity", "Robert Ludlum", "A man with no memory races to uncover his identity while evading people who want him gone.", "Action", "9780553593549", 4.4, 1],
  ["The Hunger Games", "Suzanne Collins", "Katniss volunteers for a televised contest where courage and quick thinking mean everything.", "Action", "9780439023481", 4.7, 2],
  ["The Notebook", "Nicholas Sparks", "A shared story of young love, difficult choices, and a connection that endures.", "Romance", "9780446605236", 4.3, 2],
  ["Jane Eyre", "Charlotte Bronte", "An independent young woman finds love and discovers the secrets of Thornfield Hall.", "Romance", "9780141441146", 4.5, 1],
  ["Dracula", "Bram Stoker", "A solicitor travels to Transylvania and encounters a mysterious count with a dark secret.", "Horror", "9780141439846", 4.4, 1],
  ["Frankenstein", "Mary Shelley", "A scientist creates a living being and must face the consequences of abandoning it.", "Horror", "9780141439471", 4.5, 2],
  ["Ender's Game", "Orson Scott Card", "A gifted young recruit trains at a space academy to defend humanity from an alien threat.", "Sci-Fi", "9780812550702", 4.5, 2],
  ["The Martian", "Andy Weir", "An astronaut stranded on Mars uses ingenuity and science to find a way home.", "Sci-Fi", "9780553418026", 4.6, 1],
  ["The Name of the Wind", "Patrick Rothfuss", "A gifted musician recounts the first steps of a life shaped by magic, loss, and legend.", "Fantasy", "9780756404741", 4.7, 1],
  ["The Lion, the Witch and the Wardrobe", "C.S. Lewis", "Four children step through a wardrobe into a wintry land that needs their help.", "Fantasy", "9780064471046", 4.6, 2],
  ["Into the Wild", "Jon Krakauer", "A true account of a young traveler seeking independence in the Alaskan wilderness.", "Non-Fiction", "9780385486804", 4.4, 1],
  ["The Diary of a Young Girl", "Anne Frank", "A young writer records her hopes and daily life while hiding during World War II.", "Non-Fiction", "9780553296983", 4.8, 2],
  ["The Guns of August", "Barbara W. Tuchman", "A detailed account of the decisions and opening events that shaped the First World War.", "History", "9780345476098", 4.5, 1],
  ["Team of Rivals", "Doris Kearns Goodwin", "A portrait of Abraham Lincoln and the political rivals he brought into his cabinet.", "History", "9780743270755", 4.6, 1],
  ["The Elements of Style", "William Strunk Jr. and E.B. White", "A concise guide to clear writing, useful grammar, and thoughtful editing.", "Educational", "9780205309023", 4.3, 2],
  ["Charlotte's Web", "E.B. White", "A kind friendship between a pig and a spider brings hope to a small farm.", "Children's Books", "9780064400558", 4.8, 2],
  ["Matilda", "Roald Dahl", "A clever young reader discovers her own remarkable power and stands up for what is right.", "Children's Books", "9780142410370", 4.7, 1],
];

export const sampleBooks: Book[] = titles.map(([title, author, description, category, isbn, rating, copies], index) => ({
  id: `preview-${index + 1}`,
  title,
  author,
  description,
  category,
  categoryId: category,
  coverImage: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  rating,
  totalCopies: copies,
  availableCopies: copies,
}));
