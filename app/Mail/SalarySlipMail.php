<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SalarySlipMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public array $slipData
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your Salary Slip — {$this->slipData['period']} ({$this->slipData['payroll_no']})",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.salary_slip',
        );
    }
}
