-- Remove the duplicate public review at the owner's request.
DELETE FROM reviews
WHERE lower(trim(author)) = 'jill'
  AND lower(trim(body)) = 'very satisfied with this purchase!';

DELETE FROM past_reviews
WHERE lower(trim(author)) = 'jill'
  AND lower(trim(body)) = 'very satisfied with this purchase!';
