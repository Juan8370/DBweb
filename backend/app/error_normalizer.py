import re

def normalize_db_error(raw_error: str) -> str:
    """
    Translates raw SQL engine errors into human-readable messages.
    Focuses on SQL Server and common relational errors.
    """
    msg = str(raw_error)

    # 1. Foreign Key Type Mismatch
    match = re.search(r"Column '(.+?)' is not the same data type as referencing column '(.+?)'", msg)
    if match:
        target, source = match.groups()
        return f"Error de Relación: La columna '{source}' no coincide en tipo de dato con '{target}'. Ambas deben ser del mismo tipo (ej: ambas INT o ambas VARCHAR)."

    # 1b. Missing Primary Key in referenced table (Error 1776)
    if "There are no primary or candidate keys" in msg:
        match = re.search(r"referenced table '(.+?)'", msg)
        table = match.group(1) if match else "destino"
        return f"Error de Relación: La tabla '{table}' no tiene una Llave Primaria (PK) o columna Única en ese campo. Para crear una relación, la columna en la tabla destino debe estar marcada como Primary Key."

    # 2. Duplicate Key / Unique Constraint
    if "Violation of PRIMARY KEY constraint" in msg or "Violation of UNIQUE KEY constraint" in msg:
        match = re.search(r"The duplicate key value is \((.+?)\)", msg)
        val = f" ({match.group(1)})" if match else ""
        return f"Error de Duplicado: Ya existe un registro con ese valor{val}. No se permiten duplicados en campos únicos o llaves primarias."

    # 3. Reference Constraint (Delete/Update)
    if "The DELETE statement conflicted with the REFERENCE constraint" in msg:
        match = re.search(r"table \"(.+?)\", column '(.+?)'", msg)
        table = match.group(1) if match else "otra tabla"
        return f"Error de Integridad: No se puede eliminar/modificar porque la tabla '{table}' tiene registros que dependen de este."

    # 4. Null violation
    if "Cannot insert the value NULL into column" in msg:
        match = re.search(r"column '(.+?)', table '(.+?)'", msg)
        col = match.group(1) if match else "un campo obligatorio"
        return f"Error de Datos: El campo '{col}' es obligatorio y no puede estar vacío."

    # 5. Invalid Object Name
    if "Invalid object name" in msg:
        match = re.search(r"Invalid object name '(.+?)'", msg)
        name = match.group(1) if match else "objeto"
        return f"Error de Existencia: No se encontró la tabla o vista '{name}' en la base de datos."

    # 6. Column name errors
    if "Invalid column name" in msg:
        match = re.search(r"Invalid column name '(.+?)'", msg)
        name = match.group(1) if match else "columna"
        return f"Error de Esquema: La columna '{name}' no existe en la tabla seleccionada."

    # Fallback: Clean the SQLAlchemy boilerplate but keep the core message if not matched
    clean_msg = msg.split('] [SQL:')[0] if '] [SQL:' in msg else msg
    clean_msg = clean_msg.split(') (SQLExecDirectW)') [0] if '(SQLExecDirectW)' in clean_msg else clean_msg
    
    return f"Error de Base de Datos: {clean_msg}"
