import 'package:flutter/material.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onEntrar, super.key});

  final Future<void> Function(String email, String senha) onEntrar;

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

  Future<void> _entrar() async {
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      await widget.onEntrar(_email.text.trim(), _senha.text);
    } on Exception {
      if (mounted) setState(() => _erro = 'E-mail ou senha inválidos.');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

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
