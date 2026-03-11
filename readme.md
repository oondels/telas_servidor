porta: localhost:5432

servidor para montar 
-- fabrica.controle_telas_prateleiras definição

-- Drop table

-- DROP TABLE fabrica.controle_telas_prateleiras;

CREATE TABLE fabrica.controle_telas_prateleiras (
	id bigserial NOT NULL,
	createdate timestamp NULL,
	updatedate timestamp NULL,
	usuariocreate varchar NULL,
	marca varchar NULL,
	modelo varchar NULL,
	numerotela varchar NULL,
	cor int8 NULL,
	fios int8 NULL,
	datafabricacao date NULL,
	pecas jsonb NULL,
	codbarrastela varchar NULL,
	endereco varchar NULL,
	usuarioendereco varchar NULL,
	status varchar NULL,
	usuariostatus varchar NULL,
	usuarioaltera varchar NULL,
	tamanho_etiqueta varchar NULL,
	CONSTRAINT controle_telas_prateleiras_pk PRIMARY KEY (id)
);