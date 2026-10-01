"""Valida estrutura e reproduz contagens; não substitui revisão factual das fontes."""
import csv
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
FIELDS = "nome,site,cidade_uf,tipo,oferta_principal,white_label_para_agencias,publico_declarado,preco_publico,cta_principal,etapas_do_fluxo,anuncia_meta,anuncia_google,linkedin_empresa,temas_de_conteudo,diferencial_declarado,fontes,coletado_em".split(",")
ENUMS = {
    "tipo": {"software_house", "fabrica_white_label", "agencia_digital_com_dev", "saas_para_agencias", "estudio_no_code"},
    "white_label_para_agencias": {"sim", "nao", "nao_informado"},
    "anuncia_meta": {"sim", "nao", "nao_verificado"},
    "anuncia_google": {"sim", "nao", "nao_verificado"},
    "cta_principal": {"formulario", "whatsapp", "agendar_call", "diagnostico", "orcamento", "outro"},
}
with (ROOT / "marcas.csv").open(encoding="utf-8-sig", newline="") as stream:
    reader = csv.DictReader(stream)
    assert reader.fieldnames == FIELDS, "Cabeçalho divergente"
    rows = list(reader)
assert len(rows) >= 50
domains = []
for row in rows:
    assert set(row) == set(FIELDS) and all(isinstance(v, str) and v.strip() for v in row.values())
    for field, allowed in ENUMS.items():
        assert row[field] in allowed, (row["nome"], field)
    site = urlsplit(row["site"])
    assert site.scheme == "https" and site.hostname
    domains.append(site.hostname.lower().removeprefix("www."))
    for source in row["fontes"].split(" | "):
        assert urlsplit(source).scheme == "https" and urlsplit(source).hostname
    assert re.fullmatch(r"2026-10-01", row["coletado_em"])
    text = " ".join(row.values())
    assert not re.search(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", text), row["nome"]
    assert not re.search(r"(?:\+55\s*)?\(?\d{2}\)?\s*9?\d{4}[- ]\d{4}", text), row["nome"]
assert len(domains) == len(set(domains)), "Domínio duplicado"
def normalized(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.lower()) if not unicodedata.combining(c))
keys = [(row["tipo"], normalized(row["nome"])) for row in rows]
assert keys == sorted(keys), "Ordenação tipo/nome"
synthesis = (ROOT / "sintese.md").read_text(encoding="utf-8")
for heading in ["Oferta", "Funil", "Canais e formatos de anúncio", "Preço público", "Posicionamento da nó", "Perguntas para o dot testar"]:
    assert "## " + heading in synthesis, heading
questions = synthesis.split("## Perguntas para o dot testar", 1)[1]
assert 1 <= len(re.findall(r"^\d+\. ", questions, re.M)) <= 10
assert synthesis.count("**Observações**") == 5
assert synthesis.count("**Hipóteses**") == 5
print("PASS: linhas, cabeçalho, enums, domínios, ordem, fontes, datas, contatos e estrutura da síntese")
print("Base:", len(rows))
for field in ["tipo", "cta_principal", "white_label_para_agencias", "anuncia_meta", "anuncia_google"]:
    print(field, dict(Counter(row[field] for row in rows)))
print("Preço numérico R$:", sum("R$" in row["preco_publico"] for row in rows))
print("LinkedIn público:", sum(row["linkedin_empresa"] != "nao_informado" for row in rows))
print("Temas observados:", sum(row["temas_de_conteudo"] != "nao_informado" for row in rows))
print("Fontes e nomes pessoais: verificação factual/manual independente ainda necessária.")

with (ROOT / "auditoria-por-marca.csv").open(encoding="utf-8", newline="") as stream:
    audit = list(csv.DictReader(stream))
assert len(audit) == len(rows) == 50
assert [r["nome"] for r in audit] == [r["nome"] for r in rows]
for r in audit:
    assert r["pais"] in {"Brasil", "Uruguai", "Estados Unidos", "nao_informado"}
    assert r["promessa_roadmap_prototipo_3dias"] in {"identificada", "nao_observado", "nao_verificado"}
    assert all(r.values())
    for key in ["fonte_geografia", "fonte_promessa"]:
        assert urlsplit(r[key]).scheme == "https" and urlsplit(r[key]).hostname
countries = Counter(r["pais"] for r in audit)
upper = sum(r["pais"] != "Brasil" for r in audit)
assert upper <= 10, "Teto conservador de internacionais excedido"
print("País:", dict(countries), "Teto conservador internacional:", upper)
print("Promessa conjunta:", dict(Counter(r["promessa_roadmap_prototipo_3dias"] for r in audit)))
print("PASS: apêndice 50 marcas, fontes, estados e teto numérico; recorte qualitativo de países desconhecidos segue pendente")
