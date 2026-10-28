import 'package:flutter/material.dart';

import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';

class ConvenioForm extends StatefulWidget {
  const ConvenioForm({required this.repo, this.convenio, super.key});

  final Repositorio repo;
  final Convenio? convenio;

  @override
  State<ConvenioForm> createState() => _ConvenioFormState();
}

class _ConvenioFormState extends State<ConvenioForm> {
  late final _numero = TextEditingController(text: widget.convenio?.numero);
  late final _sei = TextEditingController(text: widget.convenio?.processoSei);
  late final _cep = TextEditingController(text: widget.convenio?.resolucaoCep);
  late final _cepUrl = TextEditingController(
    text: widget.convenio?.resolucaoCepUrl,
  );
  late final _objeto = TextEditingController(text: widget.convenio?.objeto);
  late final _obs = TextEditingController(
    text: widget.convenio?.observacoesInternas,
  );
  late Minuta _minuta = widget.convenio?.minuta ?? Minuta.padraoUff;
  late Origem _origem = widget.convenio?.origem ?? Origem.concedente;
  late Situacao _situacao = widget.convenio?.situacao ?? Situacao.emTramitacao;
  late DateTime? _inicio = widget.convenio?.inicioVigencia;
  late DateTime? _fim = widget.convenio?.fimVigencia;
  late String? _concedenteId = widget.convenio?.concedenteId;
  List<Concedente> _concedentes = const [];
  Map<String, String> _erros = {};
  bool _salvando = false;

  @override
  void dispose() {
    for (final c in [_numero, _sei, _cep, _cepUrl, _objeto, _obs]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _salvar() async {
    final concedente = _concedentes
        .where((c) => c.id == _concedenteId)
        .firstOrNull;
    if (concedente == null) {
      setState(() => _erros = {'concedente': 'Escolha a concedente.'});
      return;
    }
    final base =
        widget.convenio ??
        Convenio(concedenteId: concedente.id!, concedenteNome: concedente.nome);
    final hoje = DateTime.now();
    final novo = Convenio(
      id: base.id,
      concedenteId: concedente.id!,
      concedenteNome: concedente.nome,
      numero: _numero.text.trim(),
      processoSei: _sei.text.trim(),
      resolucaoCep: _cep.text.trim(),
      resolucaoCepUrl: _cepUrl.text.trim(),
      objeto: _objeto.text.trim(),
      minuta: _minuta,
      origem: _origem,
      inicioVigencia: _inicio,
      fimVigencia: _fim,
      situacao: base.situacao,
      observacoesInternas: _obs.text.trim(),
      finalizadoEm: base.finalizadoEm,
    ).comSituacao(_situacao, hoje);

    final erros = novo.validar();
    if (erros.isNotEmpty) {
      setState(() => _erros = erros);
      return;
    }
    setState(() {
      _salvando = true;
      _erros = {};
    });
    try {
      await widget.repo.salvarConvenio(novo, anterior: widget.convenio);
      if (!mounted) return;
      Navigator.of(context).pop();
      avisar(context, 'Convênio salvo.');
    } on ErroNegocio catch (e) {
      if (mounted) setState(() => _erros = e.campos);
    } on Exception {
      if (mounted) avisar(context, 'Não foi possível salvar. Tente de novo.');
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.convenio == null ? 'Novo convênio' : 'Editar convênio',
      ),
    ),
    body: Centralizado(
      child: StreamBuilder<List<Concedente>>(
        stream: widget.repo.concedentes(),
        builder: (context, snap) {
          _concedentes = snap.data ?? const [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              DropdownButtonFormField<String>(
                initialValue: _concedentes.any((c) => c.id == _concedenteId)
                    ? _concedenteId
                    : null,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: 'Concedente',
                  errorText: _erros['concedente'],
                ),
                items: [
                  for (final c in _concedentes)
                    DropdownMenuItem(
                      value: c.id,
                      child: Text(
                        '${c.nome} · ${c.documentoFormatado}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _concedenteId = v),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _numero,
                decoration: InputDecoration(
                  labelText: 'Nº do convênio',
                  helperText: 'Ex.: PR-212/2026',
                  errorText: _erros['numero'],
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _sei,
                decoration: const InputDecoration(
                  labelText: 'Nº do processo SEI',
                  helperText: 'Ex.: 23069.179497/2026-46',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<Situacao>(
                initialValue: _situacao,
                decoration: const InputDecoration(labelText: 'Situação'),
                items: [
                  for (final s in Situacao.values)
                    DropdownMenuItem(value: s, child: Text(s.rotulo)),
                ],
                onChanged: (v) => setState(() => _situacao = v ?? _situacao),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: CampoData(
                      rotulo: 'Início da vigência',
                      valor: _inicio,
                      erro: _erros['inicio_vigencia'],
                      aoMudar: (d) => setState(() => _inicio = d),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: CampoData(
                      rotulo: 'Fim da vigência',
                      valor: _fim,
                      erro: _erros['fim_vigencia'],
                      aoMudar: (d) => setState(() => _fim = d),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<Minuta>(
                initialValue: _minuta,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Minuta'),
                items: [
                  for (final m in Minuta.values)
                    DropdownMenuItem(value: m, child: Text(m.rotulo)),
                ],
                onChanged: (v) => setState(() => _minuta = v ?? _minuta),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<Origem>(
                initialValue: _origem,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Origem'),
                items: [
                  for (final o in Origem.values)
                    DropdownMenuItem(value: o, child: Text(o.rotulo)),
                ],
                onChanged: (v) => setState(() => _origem = v ?? _origem),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _cep,
                decoration: const InputDecoration(labelText: 'Resolução CEP'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _cepUrl,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(
                  labelText: 'Link da Resolução CEP',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _objeto,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Objeto'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _obs,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Observações internas',
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _salvando ? null : _salvar,
                child: const Text('Salvar'),
              ),
            ],
          );
        },
      ),
    ),
  );
}
