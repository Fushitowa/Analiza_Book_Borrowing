create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  author text not null check (char_length(author) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  category_id uuid not null references public.categories(id) on update cascade on delete restrict,
  cover_image text,
  rating numeric(2, 1) not null default 4.5 check (rating between 0 and 5),
  total_copies integer not null check (total_copies between 1 and 500),
  available_copies integer not null check (available_copies between 0 and total_copies),
  created_at timestamptz not null default now(),
  unique (title, author)
);

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null unique,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.borrowing_records (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on update cascade on delete restrict,
  borrower_name text not null check (char_length(borrower_name) between 2 and 100),
  borrower_contact text not null check (char_length(borrower_contact) between 5 and 160),
  borrow_date timestamptz not null default now(),
  due_date timestamptz not null default (now() + interval '14 days'),
  return_date timestamptz,
  status text not null default 'pending' check (status in ('pending', 'borrowed', 'rejected', 'returned')),
  created_at timestamptz not null default now(),
  check (due_date > borrow_date),
  check ((status = 'returned') = (return_date is not null))
);

create index if not exists books_category_id_idx on public.books(category_id);
create index if not exists borrowing_records_book_status_idx on public.borrowing_records(book_id, status);
create index if not exists borrowing_records_created_at_idx on public.borrowing_records(created_at desc);

alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.staff enable row level security;
alter table public.borrowing_records enable row level security;

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "Books are publicly readable" on public.books;
create policy "Books are publicly readable" on public.books
  for select to anon, authenticated using (true);

create or replace function public.create_borrowing_request(
  p_book_id uuid,
  p_borrower_name text,
  p_borrower_contact text
) returns public.borrowing_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_book public.books%rowtype;
  new_request public.borrowing_records%rowtype;
begin
  if p_borrower_name is null or char_length(trim(p_borrower_name)) not between 2 and 100
    or p_borrower_contact is null or char_length(trim(p_borrower_contact)) not between 5 and 160 then
    raise exception using errcode = '22023', message = 'Enter a valid name and contact details.';
  end if;

  select * into target_book from public.books where id = p_book_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'This book could not be found.';
  end if;
  if target_book.available_copies < 1 then
    raise exception using errcode = 'P0001', message = 'This book is no longer available.';
  end if;

  update public.books set available_copies = available_copies - 1 where id = p_book_id;
  insert into public.borrowing_records (book_id, borrower_name, borrower_contact)
  values (p_book_id, trim(p_borrower_name), trim(p_borrower_contact))
  returning * into new_request;
  return new_request;
end;
$$;

create or replace function public.update_borrowing_request(
  p_borrowing_id uuid,
  p_action text
) returns public.borrowing_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_request public.borrowing_records%rowtype;
begin
  if p_action not in ('approve', 'reject', 'return') then
    raise exception using errcode = '22023', message = 'Choose approve, reject, or return.';
  end if;

  select * into target_request from public.borrowing_records where id = p_borrowing_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Borrowing request not found.';
  end if;

  if p_action = 'approve' and target_request.status = 'pending' then
    update public.borrowing_records set status = 'borrowed' where id = p_borrowing_id returning * into target_request;
  elsif p_action = 'reject' and target_request.status = 'pending' then
    update public.books set available_copies = available_copies + 1
      where id = target_request.book_id and available_copies < total_copies;
    update public.borrowing_records set status = 'rejected' where id = p_borrowing_id returning * into target_request;
  elsif p_action = 'return' and target_request.status = 'borrowed' then
    update public.books set available_copies = available_copies + 1
      where id = target_request.book_id and available_copies < total_copies;
    update public.borrowing_records set status = 'returned', return_date = now()
      where id = p_borrowing_id returning * into target_request;
  else
    raise exception using errcode = 'P0001', message = 'This request has already been processed or cannot be returned.';
  end if;

  return target_request;
end;
$$;

create or replace function public.save_book_inventory(
  p_book_id uuid,
  p_title text,
  p_author text,
  p_description text,
  p_category_id uuid,
  p_cover_image text,
  p_rating numeric,
  p_total_copies integer
) returns setof public.books
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_book public.books%rowtype;
  active_copies integer;
begin
  if char_length(trim(p_title)) not between 1 and 200
    or char_length(trim(p_author)) not between 1 and 160
    or char_length(coalesce(p_description, '')) > 1000
    or p_rating is null or p_rating < 0 or p_rating > 5
    or p_total_copies is null or p_total_copies not between 1 and 500 then
    raise exception using errcode = '22023', message = 'Check the book details, rating, and copy count.';
  end if;

  if p_book_id is null then
    return query insert into public.books (
      title, author, description, category_id, cover_image, rating, total_copies, available_copies
    ) values (
      trim(p_title), trim(p_author), coalesce(p_description, ''), p_category_id, p_cover_image,
      p_rating, p_total_copies, p_total_copies
    ) returning *;
    return;
  end if;

  select * into existing_book from public.books where id = p_book_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Book not found.';
  end if;

  select count(*) into active_copies from public.borrowing_records
    where book_id = p_book_id and status in ('pending', 'borrowed');
  if p_total_copies < active_copies then
    raise exception using errcode = 'P0001', message = 'Total copies cannot be less than the number currently borrowed or awaiting approval.';
  end if;

  return query update public.books set
    title = trim(p_title),
    author = trim(p_author),
    description = coalesce(p_description, ''),
    category_id = p_category_id,
    cover_image = p_cover_image,
    rating = p_rating,
    total_copies = p_total_copies,
    available_copies = p_total_copies - active_copies
  where id = p_book_id returning *;
end;
$$;

revoke all on function public.create_borrowing_request(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_borrowing_request(uuid, text) from public, anon, authenticated;
revoke all on function public.save_book_inventory(uuid, text, text, text, uuid, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.create_borrowing_request(uuid, text, text) to service_role;
grant execute on function public.update_borrowing_request(uuid, text) to service_role;
grant execute on function public.save_book_inventory(uuid, text, text, text, uuid, text, numeric, integer) to service_role;

insert into public.categories (name) values
  ('Action'), ('Romance'), ('Horror'), ('Sci-Fi'), ('Fantasy'),
  ('Fiction'), ('Non-Fiction'), ('History'), ('Educational'), ('Children''s Books')
on conflict (name) do nothing;

insert into public.books (title, author, description, category_id, cover_image, rating, total_copies, available_copies)
select seed.title, seed.author, seed.description, categories.id,
  'https://covers.openlibrary.org/b/isbn/' || seed.isbn || '-L.jpg?default=false',
  seed.rating, seed.copies, seed.copies
from (values
  ('The Hobbit', 'J.R.R. Tolkien', 'A quiet homebody sets out on an unexpected quest through a world of dragons, dwarves, and courage.', 'Fantasy', '9780547928227', 4.8, 2),
  ('Pride and Prejudice', 'Jane Austen', 'Elizabeth Bennet and Mr. Darcy discover that first impressions are not always the truest ones.', 'Romance', '9780141439518', 4.7, 2),
  ('Dune', 'Frank Herbert', 'On a desert planet, a young heir is drawn into a struggle for power, survival, and the future.', 'Sci-Fi', '9780441172719', 4.6, 1),
  ('The Midnight Library', 'Matt Haig', 'A woman explores the many lives she might have lived, and what makes one worth choosing.', 'Fiction', '9780525559474', 4.4, 2),
  ('The Silent Patient', 'Alex Michaelides', 'A therapist becomes determined to understand why a celebrated painter stopped speaking.', 'Horror', '9781250301697', 4.3, 1),
  ('Atomic Habits', 'James Clear', 'A practical guide to making small, steady changes that add up to meaningful progress.', 'Educational', '9780735211292', 4.6, 2),
  ('Educated', 'Tara Westover', 'A memoir about family, self-invention, and the power of learning to see the world anew.', 'Non-Fiction', '9780399590504', 4.5, 1),
  ('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', 'A boy discovers a magical school and a world that will change his life forever.', 'Children''s Books', '9780590353427', 4.8, 3),
  ('Sapiens', 'Yuval Noah Harari', 'A wide-ranging look at the stories and revolutions that shaped human civilization.', 'History', '9780062316097', 4.5, 1),
  ('The Book Thief', 'Markus Zusak', 'A young girl finds comfort in words and friendship in a town facing wartime hardship.', 'Fiction', '9780375842207', 4.7, 1),
  ('The Alchemist', 'Paulo Coelho', 'A shepherd follows a recurring dream on a journey toward purpose and discovery.', 'Fiction', '9780062315007', 4.4, 2),
  ('A Brief History of Time', 'Stephen Hawking', 'An inviting tour of some of the biggest questions about the universe and time.', 'Educational', '9780553380163', 4.3, 1)
) as seed(title, author, description, category_name, isbn, rating, copies)
join public.categories on categories.name = seed.category_name
on conflict (title, author) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Book covers are publicly readable" on storage.objects;
create policy "Book covers are publicly readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'book-covers');
