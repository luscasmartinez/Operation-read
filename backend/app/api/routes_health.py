from fastapi import APIRouter, Request

from app.models.leitura import StatusSincronizacao

router = APIRouter(tags=["health"])


@router.get("/health", response_model=StatusSincronizacao)
def health(request: Request):
    return StatusSincronizacao(**request.app.state.data_store.get_status())


@router.post("/refresh", response_model=StatusSincronizacao)
def refresh(request: Request):
    """Força uma resincronização imediata com o Google Drive."""
    request.app.state.data_store.sync()
    return StatusSincronizacao(**request.app.state.data_store.get_status())
