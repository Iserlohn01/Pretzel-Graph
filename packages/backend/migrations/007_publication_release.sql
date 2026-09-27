-- The PretzelGraph release a publication was built on; null for publications made before it was recorded.
alter table version_control add column release text;
