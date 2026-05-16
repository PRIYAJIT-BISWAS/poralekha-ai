alter table profiles drop constraint if exists profiles_interface_language_check;
alter table profiles drop constraint if exists profiles_preferred_language_check;

update profiles set interface_language = 'bangla' where interface_language = 'banglish';
update profiles set preferred_language = 'bangla' where preferred_language = 'mixed';

alter table profiles add constraint profiles_interface_language_check check (interface_language in ('bangla', 'english'));
alter table profiles add constraint profiles_preferred_language_check check (preferred_language in ('bangla', 'english'));