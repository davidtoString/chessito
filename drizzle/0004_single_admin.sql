-- Only the owner account (docker-owner) may ever hold a non-member role, and there can only be one.
CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner ON users(role) WHERE role <> 'member';
CREATE TRIGGER IF NOT EXISTS users_admin_insert BEFORE INSERT ON users
WHEN NEW.role <> 'member' AND NEW.id <> 'docker-owner'
BEGIN SELECT RAISE(ABORT, 'Only the owner account can have admin rights.'); END;
CREATE TRIGGER IF NOT EXISTS users_admin_update BEFORE UPDATE OF role, id ON users
WHEN (NEW.role <> 'member' AND NEW.id <> 'docker-owner') OR (OLD.id = 'docker-owner' AND (NEW.id <> OLD.id OR NEW.role <> 'owner'))
BEGIN SELECT RAISE(ABORT, 'Only the owner account can have admin rights.'); END;
