insert into public.books (title, author, description, category_id, cover_image, rating, total_copies, available_copies)
select seed.title, seed.author, seed.description, categories.id,
  'https://covers.openlibrary.org/b/isbn/' || seed.isbn || '-L.jpg?default=false',
  seed.rating, seed.copies, seed.copies
from (values
  ('The Three Musketeers', 'Alexandre Dumas', 'A young swordsman joins three loyal companions for a swashbuckling adventure in France.', 'Action', '9780140449266', 4.6, 2),
  ('The Bourne Identity', 'Robert Ludlum', 'A man with no memory races to uncover his identity while evading people who want him gone.', 'Action', '9780553593549', 4.4, 1),
  ('The Hunger Games', 'Suzanne Collins', 'Katniss volunteers for a televised contest where courage and quick thinking mean everything.', 'Action', '9780439023481', 4.7, 2),
  ('The Notebook', 'Nicholas Sparks', 'A shared story of young love, difficult choices, and a connection that endures.', 'Romance', '9780446605236', 4.3, 2),
  ('Jane Eyre', 'Charlotte Bronte', 'An independent young woman finds love and discovers the secrets of Thornfield Hall.', 'Romance', '9780141441146', 4.5, 1),
  ('Dracula', 'Bram Stoker', 'A solicitor travels to Transylvania and encounters a mysterious count with a dark secret.', 'Horror', '9780141439846', 4.4, 1),
  ('Frankenstein', 'Mary Shelley', 'A scientist creates a living being and must face the consequences of abandoning it.', 'Horror', '9780141439471', 4.5, 2),
  ('Ender''s Game', 'Orson Scott Card', 'A gifted young recruit trains at a space academy to defend humanity from an alien threat.', 'Sci-Fi', '9780812550702', 4.5, 2),
  ('The Martian', 'Andy Weir', 'An astronaut stranded on Mars uses ingenuity and science to find a way home.', 'Sci-Fi', '9780553418026', 4.6, 1),
  ('The Name of the Wind', 'Patrick Rothfuss', 'A gifted musician recounts the first steps of a life shaped by magic, loss, and legend.', 'Fantasy', '9780756404741', 4.7, 1),
  ('The Lion, the Witch and the Wardrobe', 'C.S. Lewis', 'Four children step through a wardrobe into a wintry land that needs their help.', 'Fantasy', '9780064471046', 4.6, 2),
  ('Into the Wild', 'Jon Krakauer', 'A true account of a young traveler seeking independence in the Alaskan wilderness.', 'Non-Fiction', '9780385486804', 4.4, 1),
  ('The Diary of a Young Girl', 'Anne Frank', 'A young writer records her hopes and daily life while hiding during World War II.', 'Non-Fiction', '9780553296983', 4.8, 2),
  ('The Guns of August', 'Barbara W. Tuchman', 'A detailed account of the decisions and opening events that shaped the First World War.', 'History', '9780345476098', 4.5, 1),
  ('Team of Rivals', 'Doris Kearns Goodwin', 'A portrait of Abraham Lincoln and the political rivals he brought into his cabinet.', 'History', '9780743270755', 4.6, 1),
  ('The Elements of Style', 'William Strunk Jr. and E.B. White', 'A concise guide to clear writing, useful grammar, and thoughtful editing.', 'Educational', '9780205309023', 4.3, 2),
  ('Charlotte''s Web', 'E.B. White', 'A kind friendship between a pig and a spider brings hope to a small farm.', 'Children''s Books', '9780064400558', 4.8, 2),
  ('Matilda', 'Roald Dahl', 'A clever young reader discovers her own remarkable power and stands up for what is right.', 'Children''s Books', '9780142410370', 4.7, 1)
) as seed(title, author, description, category_name, isbn, rating, copies)
join public.categories on categories.name = seed.category_name
on conflict (title, author) do nothing;
