import 'package:flutter/material.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onEntrar, this.onGoogle, super.key});

  final Future<void> Function(String email, String senha) onEntrar;

  /// D26: entrada com o Google (`@id.uff.br`). Nulo esconde o botão.
  final Future<void> Function()? onGoogle;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _senha = TextEditingController();
  String? _erro;
  bool _enviando = false;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _tentar(
    Future<void> Function() acao,
    String mensagemDeErro,
  ) async {
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      await acao();
    } on Exception {
      if (mounted) setState(() => _erro = mensagemDeErro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _entrar() => _tentar(
    () => widget.onEntrar(_email.text.trim(), _senha.text),
    'E-mail ou senha inválidos.',
  );

  Future<void> _google() => _tentar(
    widget.onGoogle!,
    'Não foi possível entrar com o Google. Use sua conta @id.uff.br.',
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Estágios UFF')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.onGoogle != null) ...[
                OutlinedButton.icon(
                  onPressed: _enviando ? null : _google,
                  icon: const Icon(Icons.login),
                  label: const Text('Entrar com Google (@id.uff.br)'),
                ),
                const SizedBox(height: 16),
                const Text('ou, com e-mail e senha:'),
              ],
              TextField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'E-mail'),
                keyboardType: TextInputType.emailAddress,
              ),
              TextField(
                controller: _senha,
                decoration: const InputDecoration(labelText: 'Senha'),
                obscureText: true,
              ),
              if (_erro != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_erro!),
                ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _enviando ? null : _entrar,
                child: const Text('Entrar'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
