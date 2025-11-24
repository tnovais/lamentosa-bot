"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Play, Pause, Square, Shield, Skull, Clock, Trophy, Coins, Activity, User } from "lucide-react"
import { useState, useEffect } from "react"

interface BotCardProps {
    account: any;
    onCommand: (type: string) => void;
    onDelete: () => void;
}

export function BotCard({ account, onCommand, onDelete }: BotCardProps) {
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('');

    const [serverTime, setServerTime] = useState<string>('');

    // Real-time Server Clock Logic
    useEffect(() => {
        if (account.lastServerTime && account.updatedAt) {
            const updateClock = () => {
                try {
                    const [h, m, s] = account.lastServerTime.split(':').map(Number);
                    const lastServerSeconds = h * 3600 + m * 60 + s;

                    const now = new Date().getTime();
                    const updatedAt = new Date(account.updatedAt).getTime();
                    const diffSeconds = Math.floor((now - updatedAt) / 1000);

                    let currentTotalSeconds = lastServerSeconds + diffSeconds;

                    // Handle day rollover (simple version, doesn't increment day number visually but resets time)
                    currentTotalSeconds = currentTotalSeconds % (24 * 3600);

                    const curH = Math.floor(currentTotalSeconds / 3600);
                    const curM = Math.floor((currentTotalSeconds % 3600) / 60);
                    const curS = currentTotalSeconds % 60;

                    const fmt = (n: number) => n.toString().padStart(2, '0');
                    setServerTime(`${fmt(curH)}:${fmt(curM)}:${fmt(curS)}`);
                } catch (e) {
                    setServerTime(account.lastServerTime);
                }
            };

            updateClock(); // Initial update
            const interval = setInterval(updateClock, 1000);
            return () => clearInterval(interval);
        }
    }, [account.lastServerTime, account.updatedAt]);

    const handleCommand = async (type: string) => {
        setLoading(true);
        await onCommand(type);
        setLoading(false);
    };

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this account?')) {
            setLoading(true);
            await onDelete();
            setLoading(false);
        }
    };

    const stats = account.dailyStats?.[0] || { gold: 0, pvpWins: 0, pvpLosses: 0, pveCount: 0 };
    const status = account.status || (account.isActive ? 'Active' : 'Stopped');
    const rankingTarget = account.rankingTarget || 15;
    const winsToRank = Math.max(0, rankingTarget - stats.pvpWins);
    const rankProgress = rankingTarget > 0 ? (stats.pvpWins / rankingTarget) * 100 : 0;

    // HP Percentage
    const hpPercent = account.maxHp && account.maxHp > 0 ? (account.currentHp / account.maxHp) * 100 : 100;

    // Status Color Logic
    const getStatusVariant = (s: string) => {
        switch (s) {
            case 'RUNNING': return 'default'; // Green/Black (default badge style usually works)
            case 'COOLDOWN': return 'secondary';
            case 'STARTING': return 'outline';
            case 'OFFLINE': return 'destructive';
            case 'CAPTCHA_FAILED': return 'destructive';
            default: return 'outline';
        }
    };

    const statusColors: Record<string, string> = {
        RUNNING: "bg-green-500",
        IDLE: "bg-yellow-500",
        COOLDOWN: "bg-blue-500",
        OFFLINE: "bg-gray-500",
        CAPTCHA_FAILED: "bg-red-500",
        STARTING: "bg-purple-500"
    };

    // Cooldown Timer Logic
    useEffect(() => {
        if (status === 'COOLDOWN' && account.cooldownEndsAt) {
            const interval = setInterval(() => {
                const now = new Date().getTime();
                const end = new Date(account.cooldownEndsAt).getTime();
                const distance = end - now;

                if (distance < 0) {
                    setTimeLeft('Ready');
                    clearInterval(interval);
                } else {
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                    setTimeLeft(`${minutes}m ${seconds}s`);
                }
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setTimeLeft('');
        }
    }, [status, account.cooldownEndsAt]);

    return (
        <Card className="w-[350px] shadow-lg transition-all hover:shadow-xl">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {account.characterImage ? (
                            <img src={account.characterImage} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-200" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                                <User className="w-6 h-6 text-gray-400" />
                            </div>
                        )}
                        <div>
                            <CardTitle className="text-lg font-bold truncate w-[160px]" title={account.email}>
                                {account.characterName || account.email}
                            </CardTitle>
                            {account.characterLevel && <Badge variant="outline" className="text-[10px] h-4 px-1">Lv {account.characterLevel}</Badge>}
                        </div>
                    </div>

                    <Badge className={`${statusColors[status] || "bg-gray-500"} text-white hover:opacity-90 uppercase text-[10px]`}>
                        {status}
                    </Badge>
                </div>
                <CardDescription className="flex justify-between items-center pt-1">
                    {status === 'COOLDOWN' && timeLeft ? (
                        <span className="text-blue-500 font-mono text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeLeft}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">ID: {account.id.substring(0, 8)}</span>
                    )}
                    {serverTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1" title="Server Time">
                            <Clock className="h-3 w-3" />
                            {account.serverDay ? `Dia ${account.serverDay} | ` : ''}
                            {serverTime}
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* HP Bar */}
                <div className="mb-4 space-y-1">
                    <div className="flex justify-between text-[10px] font-medium uppercase text-muted-foreground">
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> HP</span>
                        <span>{account.currentHp || '?'}/{account.maxHp || '?'}</span>
                    </div>
                    <Progress value={hpPercent} className="h-1.5 bg-gray-100 [&>div]:bg-red-500" />
                </div>

                <div className="grid gap-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col p-2 bg-muted/30 rounded-md">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="w-3 h-3" /> PVP Wins</span>
                            <span className="font-bold text-green-600 text-lg">{stats.pvpWins}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/30 rounded-md">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Skull className="w-3 h-3" /> PVP Losses</span>
                            <span className="font-bold text-red-500 text-lg">{stats.pvpLosses}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded-md">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Gold Earned</span>
                            <span className="text-yellow-600 font-bold">{stats.gold.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-xs text-muted-foreground">Current Gold</span>
                            <span className="text-yellow-700 font-bold">{account.currentGold ? account.currentGold.toLocaleString() : '?'}</span>
                        </div>
                    </div>

                    {/* Ranking Progress */}
                    <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Ranking Target ({rankingTarget})</span>
                            <span className="text-blue-600 font-bold">{winsToRank > 0 ? `${winsToRank} wins to go` : "Target Met!"}</span>
                        </div>
                        <Progress value={rankProgress} className="h-1.5" />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
                <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCommand('RESUME')} disabled={loading} title="Resume">
                        <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCommand('PAUSE')} disabled={loading} title="Pause">
                        <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCommand('STOP')} disabled={loading} title="Stop">
                        <Square className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex gap-1">
                    <Button variant="default" size="icon" className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleCommand('FORCE_PVP')} disabled={loading} title="Force PVP Attack">
                        <Shield className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={loading} title="Delete Account">
                        <Skull className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
